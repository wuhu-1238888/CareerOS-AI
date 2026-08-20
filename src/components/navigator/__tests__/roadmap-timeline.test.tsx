// 成长路线时间线测试(3.4):sticky 概要条(路径文案 + 总进度 + 重新生成)、阶段卡默认折叠与展开内容
// (目标/学习内容/实践项目含产出物/检查点/任务列表)、节点与阶段状态联动、任务交互接线(3.5 回调)
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoadmapTimeline, type TimelineRoadmap } from "../roadmap-timeline";

// 4 阶段:阶段1 全部完成(done),阶段2 进行中(current,默认展开),阶段3/4 未开始
// 总任务 7、完成 3 → 总进度 43%
const roadmap: TimelineRoadmap = {
  id: "r1",
  targetDirection: "后端开发",
  weeklyHours: 10,
  currentStage: "有一定基础",
  summary: {
    totalDuration: "6 个月",
    stageCount: 4,
    finalGoal: "达到初级后端开发工程师水平",
  },
  stages: [
    {
      id: "s1",
      name: "夯实基础",
      goal: "掌握 Python 与 SQL 基础",
      order: 1,
      estimatedDuration: "2 个月",
      content: {
        learningContent: ["Python 语法", "SQL 查询", "HTTP 基础"],
        practiceProjects: [{ title: "图书管理 API", deliverable: "可运行的 REST API" }],
        resources: ["Python 官方文档"],
        checkpoints: ["能独立完成数据清洗"],
      },
      tasks: [
        { id: "t1", description: "学习 Python 语法", type: "学习", status: "completed", order: 1 },
        { id: "t2", description: "学习 SQL 查询", type: "学习", status: "completed", order: 2 },
        { id: "t3", description: "完成 API 项目", type: "实践项目", status: "completed", order: 3 },
      ],
    },
    {
      id: "s2",
      name: "框架进阶",
      goal: "掌握 Web 框架与工程化",
      order: 2,
      estimatedDuration: "2 个月",
      content: {
        learningContent: ["FastAPI", "SQLAlchemy", "接口鉴权"],
        practiceProjects: [{ title: "任务管理后端", deliverable: "含鉴权的完整后端项目" }],
        resources: [],
        checkpoints: ["实现带 JWT 鉴权的 CRUD 服务"],
      },
      tasks: [
        { id: "t4", description: "学习 FastAPI", type: "学习", status: "in_progress", order: 1 },
        { id: "t5", description: "学习接口鉴权", type: "学习", status: "pending", order: 2 },
      ],
    },
    {
      id: "s3",
      name: "工程化与部署",
      goal: "掌握测试与部署",
      order: 3,
      estimatedDuration: "1 个月",
      content: {
        learningContent: ["pytest", "Docker", "CI 管线"],
        practiceProjects: [{ title: "工程化改造", deliverable: "含 CI 的仓库" }],
        resources: [],
        checkpoints: [],
      },
      tasks: [{ id: "t6", description: "学习 Docker", type: "学习", status: "pending", order: 1 }],
    },
    {
      id: "s4",
      name: "高并发与求职准备",
      goal: "理解高并发基础",
      order: 4,
      estimatedDuration: "1 个月",
      content: {
        learningContent: ["消息队列", "Redis", "简历准备"],
        practiceProjects: [{ title: "秒杀系统 demo", deliverable: "高并发 demo 与设计文档" }],
        resources: [],
        checkpoints: [],
      },
      tasks: [{ id: "t7", description: "学习 Redis", type: "学习", status: "pending", order: 1 }],
    },
  ],
};

describe("RoadmapTimeline 概要条", () => {
  it("路径文案 + 最终目标 + 总进度(3/7=43%)+ 重新生成按钮", () => {
    const onRegenerate = vi.fn();
    render(<RoadmapTimeline roadmap={roadmap} onRegenerate={onRegenerate} />);
    expect(screen.getByText("成为「后端开发」的 6 个月 路径")).toBeInTheDocument();
    expect(screen.getByText("达到初级后端开发工程师水平")).toBeInTheDocument();
    expect(screen.getByText("总进度 43%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeInTheDocument();
  });

  it("未提供 onRegenerate:重新生成按钮不渲染", () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    expect(screen.queryByRole("button", { name: "重新生成" })).toBeNull();
  });

  it("summary 缺失(防御解析失败):路径文案回退", () => {
    render(<RoadmapTimeline roadmap={{ ...roadmap, summary: null }} />);
    expect(screen.getByText("成为「后端开发」的 成长 路径")).toBeInTheDocument();
  });
});

describe("RoadmapTimeline 时间线与阶段卡", () => {
  it("节点三态与阶段 badge:1 已完成 / 1 进行中 / 2 未开始,4 个阶段卡标题", () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    expect(screen.getAllByText("已完成")).toHaveLength(1); // 阶段 1 badge(任务列表折叠中)
    expect(screen.getAllByText("进行中")).toHaveLength(2); // 阶段 2 badge + 展开任务状态文案
    expect(screen.getAllByText("未开始")).toHaveLength(2);
    for (const name of ["夯实基础", "框架进阶", "工程化与部署", "高并发与求职准备"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("默认展开首个未完成阶段(框架进阶),其余折叠;点击切换展开/折叠", async () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    // 默认展开:框架进阶目标可见;已完成阶段 夯实基础 目标不可见
    expect(screen.getByText("掌握 Web 框架与工程化")).toBeInTheDocument();
    expect(screen.queryByText("掌握 Python 与 SQL 基础")).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /夯实基础/ }));
    expect(screen.getByText("掌握 Python 与 SQL 基础")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /夯实基础/ }));
    expect(screen.queryByText("掌握 Python 与 SQL 基础")).toBeNull();
  });

  it("展开内容:学习内容 Tags + 实践项目含产出物 + 检查点 + 资源 + 任务列表(状态符号+文字双通道)", () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    // 默认展开的 框架进阶
    expect(screen.getByText("学习内容")).toBeInTheDocument();
    expect(screen.getByText("FastAPI")).toBeInTheDocument();
    expect(screen.getByText("产出物:含鉴权的完整后端项目")).toBeInTheDocument();
    expect(screen.getByText("实现带 JWT 鉴权的 CRUD 服务")).toBeInTheDocument();
    // 任务状态:进行中 + 待开始(符号与文字同时存在)
    expect(screen.getAllByText("进行中")).toHaveLength(2); // 阶段 badge + 任务状态文案
    expect(screen.getByText("学习接口鉴权")).toBeInTheDocument();
    expect(screen.getByText("待开始")).toBeInTheDocument();
  });
});

describe("RoadmapTimeline 多阶段展开(UI/UX 优化)", () => {
  it("展开其他阶段不收起已展开阶段,可同时展开多个;点击已展开阶段才收起", async () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    const user = userEvent.setup();
    // 默认展开 框架进阶(首个未完成)
    expect(screen.getByText("掌握 Web 框架与工程化")).toBeInTheDocument();
    // 展开 夯实基础 → 框架进阶 保持展开
    await user.click(screen.getByRole("button", { name: /夯实基础/ }));
    expect(screen.getByText("掌握 Python 与 SQL 基础")).toBeInTheDocument();
    expect(screen.getByText("掌握 Web 框架与工程化")).toBeInTheDocument();
    // 再展开 工程化与部署 → 前两个仍保持展开
    await user.click(screen.getByRole("button", { name: /工程化与部署/ }));
    expect(screen.getByText("掌握测试与部署")).toBeInTheDocument();
    expect(screen.getByText("掌握 Python 与 SQL 基础")).toBeInTheDocument();
    expect(screen.getByText("掌握 Web 框架与工程化")).toBeInTheDocument();
    // 点击已展开阶段 → 仅该阶段收起,其余保持
    await user.click(screen.getByRole("button", { name: /夯实基础/ }));
    expect(screen.queryByText("掌握 Python 与 SQL 基础")).toBeNull();
    expect(screen.getByText("掌握测试与部署")).toBeInTheDocument();
    expect(screen.getByText("掌握 Web 框架与工程化")).toBeInTheDocument();
  });
});

describe("RoadmapTimeline 概览带(UI/UX 优化)", () => {
  it("目标岗位/整体进度两区:路径文案、每周投入、当前阶段名、总进度、重新生成", () => {
    const onRegenerate = vi.fn();
    render(<RoadmapTimeline roadmap={roadmap} onRegenerate={onRegenerate} />);
    expect(screen.getByText("目标岗位")).toBeInTheDocument();
    expect(screen.getByText("整体进度")).toBeInTheDocument();
    expect(screen.getByText("每周 10 小时 · 有一定基础")).toBeInTheDocument();
    expect(screen.getByText("当前阶段:框架进阶")).toBeInTheDocument();
    expect(screen.getByText("总进度 43%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeInTheDocument();
  });

  it("全部阶段完成:总进度 100% 且不显示当前阶段名", () => {
    const allDone: TimelineRoadmap = {
      ...roadmap,
      stages: roadmap.stages.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => ({ ...t, status: "completed" })),
      })),
    };
    render(<RoadmapTimeline roadmap={allDone} />);
    expect(screen.queryByText(/当前阶段:/)).toBeNull();
    expect(screen.getByText("总进度 100%")).toBeInTheDocument();
  });

  it("阶段卡头部:阶段序号眉标 + 任务计数", () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    expect(screen.getByText("阶段 1")).toBeInTheDocument();
    expect(screen.getByText("阶段 4")).toBeInTheDocument();
    expect(screen.getByText("3/3 任务")).toBeInTheDocument();
  });
});

describe("RoadmapTimeline 任务交互接线(3.5 回调)", () => {
  it("未提供 onToggleTask:任务只读(无任务切换按钮)", () => {
    render(<RoadmapTimeline roadmap={roadmap} />);
    expect(screen.queryByRole("button", { name: /点击切换状态/ })).toBeNull();
  });

  it("提供 onToggleTask:点击任务按三态循环调用(待开始 → 进行中)", async () => {
    const onToggleTask = vi.fn();
    render(<RoadmapTimeline roadmap={roadmap} onToggleTask={onToggleTask} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /任务「学习接口鉴权」/ }));
    expect(onToggleTask).toHaveBeenCalledWith("t5", "in_progress");
  });

  it("pendingTaskId:切换 mutation 在途的任务禁用,其余任务仍可点", async () => {
    const onToggleTask = vi.fn();
    render(
      <RoadmapTimeline roadmap={roadmap} onToggleTask={onToggleTask} pendingTaskId="t5" />
    );
    expect(screen.getByRole("button", { name: /任务「学习接口鉴权」/ })).toBeDisabled();
    const other = screen.getByRole("button", { name: /任务「学习 FastAPI」/ });
    expect(other).toBeEnabled();
    await userEvent.setup().click(other);
    expect(onToggleTask).toHaveBeenCalledWith("t4", "completed");
  });

  it("提供 onFeedbackTask:每个任务附「太难了/已经会了」,点击传参;阶段调整中禁用 + ai-badge「调整中」", async () => {
    const onFeedbackTask = vi.fn();
    render(
      <RoadmapTimeline roadmap={roadmap} onFeedbackTask={onFeedbackTask} regeneratingStageId="s2" />
    );
    // 默认展开的阶段 2 有 2 个任务 → 4 个反馈按钮
    expect(screen.getAllByRole("button", { name: "太难了" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "已经会了" })).toHaveLength(2);
    // 调整中:按钮禁用 + 提示可见
    expect(screen.getByText("调整中")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "太难了" })) {
      expect(button).toBeDisabled();
    }
    // 未在调整中的阶段(展开 夯实基础 后)按钮可用
    await userEvent.setup().click(screen.getByRole("button", { name: /夯实基础/ }));
    const enabled = screen.getAllByRole("button", { name: "太难了" }).find((b) => !b.hasAttribute("disabled"));
    expect(enabled).toBeDefined();
    await userEvent.setup().click(enabled!);
    expect(onFeedbackTask).toHaveBeenCalledWith("t1", "太难了");
  });
});
