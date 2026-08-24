// 联动规则服务(8.1b):三条联动规则的「活跃候选」评估 + LinkageHint 去重。
// 规则本身是状态派生(只读域表);LinkageHint 只记「用户对某版本提示的关闭动作」——
// dismissedAt 非空 = 已关闭(同 (userId, kind, refVersion) 不再骚扰);无行或 dismissedAt 为空 = 活跃。
// refVersion 语义:resume_project = 路线图 id(替换式重新生成 → 新 id → 新提示);
// resume_outdated / roadmap_outdated = 画像版本号(新画像版本 → 新提示,版本隔离不串数据)。
import type { PrismaClient } from "@prisma/client";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import { stageContentSchema } from "@/lib/navigator/analysis-schemas";

export type LinkageRule =
  | {
      kind: "resume_project";
      refVersion: string; // 路线图 id
      roadmapId: string;
      stageName: string;
      projectTitle: string; // 实践项目标题(任务 description 同源)
      deliverable: string; // 产出物(阶段 content.practiceProjects 中同名条目;缺失时为空串)
    }
  | {
      kind: "resume_outdated" | "roadmap_outdated";
      refVersion: string; // 画像版本号
      profileVersion: number;
      profileUpdatedAt: string; // 最新画像生成时间(ISO)
      staleUpdatedAt: string; // 简历最新版本生成时间 / 路线图生成时间(ISO)
    };

const PROJECT_TASK_TYPE = "实践项目";

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_·:：,、。.()（）[\]【】/\\]/g, "");
}

// 简历项目是否已覆盖该标题(归一化后互相包含视为已有;纯提示场景用宽松判据)
function resumeCoversProject(projects: { name?: string }[], title: string): boolean {
  const t = normalizeTitle(title);
  if (!t) return false;
  return projects.some((p) => {
    const n = normalizeTitle(p.name ?? "");
    return n.length > 0 && (n.includes(t) || t.includes(n));
  });
}

// 当前阶段 = 首个含未完成任务(pending/in_progress)的阶段;全部完成 → 最后一个阶段(收尾提示仍有用)
function currentStageOf<T extends { tasks: { status: string }[] }>(stages: T[]): T | null {
  return stages.find((stage) => stage.tasks.some((task) => task.status !== "completed"))
    ?? stages[stages.length - 1]
    ?? null;
}

export async function evaluateLinkageRules(db: PrismaClient, userId: string): Promise<LinkageRule[]> {
  const [profile, roadmap, resume] = await Promise.all([
    db.careerProfile.findFirst({ where: { userId }, orderBy: { version: "desc" } }),
    db.roadmap.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { stages: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } } },
    }),
    db.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const rules: LinkageRule[] = [];

  // 规则② roadmap-outdated:最新画像晚于路线图生成时间 → 路线图可能需重新生成
  if (profile && roadmap && profile.createdAt > roadmap.createdAt) {
    rules.push({
      kind: "roadmap_outdated",
      refVersion: String(profile.version),
      profileVersion: profile.version,
      profileUpdatedAt: profile.createdAt.toISOString(),
      staleUpdatedAt: roadmap.createdAt.toISOString(),
    });
  }

  // 规则② resume-outdated:最新画像晚于简历最新版本生成时间 → 简历可能需重新生成
  if (profile && resume?.versions[0] && profile.createdAt > resume.versions[0].createdAt) {
    rules.push({
      kind: "resume_outdated",
      refVersion: String(profile.version),
      profileVersion: profile.version,
      profileUpdatedAt: profile.createdAt.toISOString(),
      staleUpdatedAt: resume.versions[0].createdAt.toISOString(),
    });
  }

  // 规则① resume-project(D2:只提示不写):当前阶段已完成的实践项目未出现在简历 → 提示「可加入简历」。
  // 无简历时跳过(无从比对);标题已覆盖的项目跳过。
  if (roadmap && resume) {
    const parsed = parsedResumeSchema.safeParse(resume.parsedData);
    const resumeProjects = parsed.success ? parsed.data.projects : [];
    const stage = currentStageOf(roadmap.stages);
    const eligibleProject = stage?.tasks.find(
      (task) => task.type === PROJECT_TASK_TYPE && task.status === "completed"
        && !resumeCoversProject(resumeProjects, task.description)
    );
    if (stage && eligibleProject) {
      const content = stageContentSchema.safeParse(stage.content);
      const deliverable = content.success
        ? content.data.practiceProjects.find(
            (p) => normalizeTitle(p.title) === normalizeTitle(eligibleProject.description)
          )?.deliverable ?? ""
        : "";
      rules.push({
        kind: "resume_project",
        refVersion: roadmap.id,
        roadmapId: roadmap.id,
        stageName: stage.name,
        projectTitle: eligibleProject.description,
        deliverable,
      });
    }
  }

  // 去重:已关闭(同 (userId, kind, refVersion) 且 dismissedAt 非空)的不再返回
  const active = await Promise.all(
    rules.map(async (rule) => {
      const hint = await db.linkageHint.findUnique({
        where: { userId_kind_refVersion: { userId, kind: rule.kind, refVersion: rule.refVersion } },
      });
      return hint && hint.dismissedAt != null ? null : rule;
    })
  );
  return active.filter((rule): rule is LinkageRule => rule != null);
}
