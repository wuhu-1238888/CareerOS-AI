// 种子脚本:写入并读回全部核心表(1.3 验证要求)。幂等:重复执行先清理再重建。
// 运行:npm run db:seed(Prisma CLI 自动加载 .env)
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_EMAIL = "seed@careeros.local";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`种子校验失败:${message}`);
  }
}

async function main() {
  // 幂等清理:删除既有种子用户(级联清空其画像/简历;AgentRun 保留为 SetNull)
  await prisma.user.deleteMany({ where: { email: SEED_EMAIL } });

  // 1. User
  const user = await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      name: "种子用户",
      avatarColor: "green",
      passwordHash: "seeded-hash-not-a-real-password",
      authMethod: "password",
    },
  });
  const userBack = await prisma.user.findUnique({ where: { email: SEED_EMAIL } });
  assert(userBack?.id === user.id, "User 写入读回");
  console.log(`✓ User            ${userBack.name} <${userBack.email}>`);

  // 2. CareerProfile v1 + v2(版本字段:version / parentVersion)
  const profileV1 = await prisma.careerProfile.create({
    data: {
      userId: user.id,
      version: 1,
      education: [
        { school: "示例大学", major: "软件工程", degree: "本科", start: "2022-09", end: "2026-06" },
      ],
      skills: ["TypeScript", "React", "Node.js"],
      experiences: [{ company: "示例科技", role: "前端实习生", description: "参与中后台开发" }],
      interests: ["前端工程化", "AI 应用"],
      targets: [{ role: "前端开发工程师", industry: "互联网" }],
      aiAnalysis: {
        // 六维技能雷达并入 ai_analysis(已确认偏差:不建 SkillRadar 表)
        radar: [
          { dimension: "编程能力", score: 72 },
          { dimension: "工程能力", score: 60 },
          { dimension: "沟通协作", score: 65 },
          { dimension: "学习能力", score: 80 },
          { dimension: "领域知识", score: 55 },
          { dimension: "项目经验", score: 50 },
        ],
        summary: "种子画像 v1 分析摘要",
      },
    },
  });
  const profileV2 = await prisma.careerProfile.create({
    data: {
      userId: user.id,
      version: 2,
      parentVersion: 1,
      education: profileV1.education ?? Prisma.JsonNull,
      skills: [...(profileV1.skills as string[]), "Next.js"],
      aiAnalysis: { summary: "种子画像 v2 分析摘要" },
    },
  });
  const profiles = await prisma.careerProfile.findMany({
    where: { userId: user.id },
    orderBy: { version: "asc" },
  });
  assert(profiles.length === 2, "CareerProfile 两版本写入读回");
  assert(profiles[1].parentVersion === 1, "parentVersion 指向 v1");
  const radar = profiles[0].aiAnalysis as { radar?: unknown[] };
  assert(Array.isArray(radar?.radar) && radar.radar.length === 6, "六维雷达并入 aiAnalysis");
  console.log(`✓ CareerProfile   v1(雷达 6 维)+ v2(parentVersion=${profileV2.parentVersion})`);

  // 3. CareerPath(推荐方向;matchScore 为 0~100 整数,见 M2 迁移 20260820024904)
  const path = await prisma.careerPath.create({
    data: {
      profileId: profileV1.id,
      directionName: "前端开发工程师",
      matchScore: 82,
      strengths: ["技术栈匹配", "有实习经历"],
      weaknesses: ["项目深度不足"],
    },
  });
  const pathBack = await prisma.careerPath.findFirst({ where: { profileId: profileV1.id } });
  assert(pathBack?.id === path.id && pathBack.matchScore === 82, "CareerPath 写入读回");
  console.log(`✓ CareerPath      ${pathBack?.directionName}(${pathBack?.matchScore ?? 0}%)`);

  // 4. Roadmap → Stage → Task(任务三态覆盖;3.1 起 roadmap 带 userId 直连列)
  const roadmap = await prisma.roadmap.create({
    data: {
      userId: user.id,
      profileId: profileV1.id,
      targetDirection: "前端开发工程师",
      weeklyHours: 10,
      currentStage: "有一定基础",
    },
  });
  const stage1 = await prisma.stage.create({
    data: {
      roadmapId: roadmap.id,
      name: "夯实基础",
      goal: "掌握 JS 核心与 TS",
      order: 1,
      estimatedDuration: "2 周",
      content: { learn: ["JS 核心", "TS"], projects: ["个人主页"], checkpoint: "TS 小项目" },
    },
  });
  const stage2 = await prisma.stage.create({
    data: {
      roadmapId: roadmap.id,
      name: "框架进阶",
      goal: "React 与工程化",
      order: 2,
      estimatedDuration: "3 周",
      content: { learn: ["React", "构建工具"], projects: ["带后端的前端项目"], checkpoint: "工程化实践" },
    },
  });
  await prisma.task.create({
    data: { stageId: stage1.id, description: "学习 TS 类型系统", type: "学习", status: "completed", order: 1 },
  });
  await prisma.task.create({
    data: { stageId: stage1.id, description: "完成 TS 小项目", type: "实践项目", status: "in_progress", order: 2 },
  });
  await prisma.task.create({
    data: { stageId: stage2.id, description: "学习 React Hooks", type: "学习", status: "pending", order: 1 },
  });
  const roadmapBack = await prisma.roadmap.findUnique({
    where: { id: roadmap.id },
    include: { stages: { include: { tasks: true }, orderBy: { order: "asc" } } },
  });
  assert(roadmapBack?.stages.length === 2, "Roadmap/Stage 写入读回");
  const statuses = roadmapBack.stages.flatMap((s) => s.tasks.map((t) => t.status)).sort();
  assert(
    JSON.stringify(statuses) === JSON.stringify(["completed", "in_progress", "pending"]),
    "Task 三态覆盖"
  );
  console.log(`✓ Roadmap+Stage   ${roadmapBack.stages.length} 阶段 / ${statuses.length} 任务(三态)`);

  // 5. Resume → ResumeVersion → Optimization
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      originalText: "张三\n前端实习生\n- 负责中后台页面开发",
      parsedData: { name: "张三", role: "前端实习生", skills: ["React"] },
    },
  });
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: resume.id,
      targetDirection: "前端开发工程师",
      optimizedText: "张三\n前端开发实习生\n- 主导 3 个中后台模块开发,页面性能提升 20%",
      changes: { count: 3 },
      atsScore: 85,
    },
  });
  const opt = await prisma.optimization.create({
    data: {
      resumeVersionId: version.id,
      category: "量化表达",
      originalText: "负责中后台页面开发",
      optimizedText: "主导 3 个中后台模块开发,页面性能提升 20%",
      reason: "补充量化结果,体现影响力",
    },
  });
  const versionBack = await prisma.resumeVersion.findUnique({
    where: { id: version.id },
    include: { optimizations: true },
  });
  assert(versionBack?.atsScore === 85 && versionBack.optimizations.length === 1, "Resume 链写入读回");
  console.log(`✓ Resume          1 简历 / ${versionBack.optimizations.length} 条优化记录(ATS ${versionBack.atsScore})`);

  // 6. AgentRun(观测日志)
  const run = await prisma.agentRun.create({
    data: {
      userId: user.id,
      agentName: "seed-agent",
      intent: "seed",
      status: "succeeded",
      input: { email: SEED_EMAIL },
      output: { summary: "种子写入完成" },
      durationMs: 42,
    },
  });
  const runBack = await prisma.agentRun.findUnique({ where: { id: run.id } });
  assert(runBack?.status === "succeeded" && runBack.durationMs === 42, "AgentRun 写入读回");
  console.log(`✓ AgentRun        ${runBack.agentName}(${runBack.durationMs}ms, ${runBack.status})`);

  // 7. 级联验证:删除种子用户 → CareerProfile/Resume 级联删除,AgentRun 保留(SetNull)
  await prisma.user.delete({ where: { id: user.id } });
  const remainingProfiles = await prisma.careerProfile.count({ where: { userId: user.id } });
  const remainingResumes = await prisma.resume.count({ where: { userId: user.id } });
  const remainingRuns = await prisma.agentRun.count({ where: { id: run.id } });
  assert(remainingProfiles === 0 && remainingResumes === 0, "删 User 级联删除画像/简历");
  assert(remainingRuns === 1, "删 User 后 AgentRun 保留");
  console.log("✓ 级联策略        删 User → 画像/简历级联删除;AgentRun 保留(SetNull)");

  console.log("\n种子脚本完成:全部核心表写入读回通过,级联行为符合预期。");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
