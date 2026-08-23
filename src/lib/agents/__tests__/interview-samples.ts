// 固定样例集(7.1):3 份手工标注的模拟面试出题输入 + 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、五类题型全覆盖、至少 3 题能从输入简历找到出处、
// 换岗位题目差异明显、题数恒等于档位(管线 echo 校验依据)。
// 真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1),本样例集保证管线正确性。
import type { InterviewQuestionAgentInput, InterviewQuestions } from "../interview-question.agent";

export type InterviewQuestionSample = {
  id: string;
  description: string;
  input: InterviewQuestionAgentInput;
  /** 标注:简历中真实存在的关键词——至少 3 道题的 evidence 应命中其中至少一个 */
  expectedEvidenceKeywords: string[];
  /** 手工构造的 Mock 输出(需通过 outputSchema,题数 = input.questionCount,与标注一致) */
  mockOutput: InterviewQuestions;
};

const backendResume = `张同学
教育背景:计算机科学与技术专业本科
技术栈:Python 熟练、SQL 熟练、JavaScript 基础
实习经历:后端实习 3 个月,负责订单服务接口开发与 MySQL 数据表设计,与前端、测试协作联调
项目经历:校园二手交易平台后端,独立完成商品发布与订单模块,日均请求约 1000 次`;

const productResume = `李同学
教育背景:工商管理专业本科
实习经历:互联网公司产品实习 4 个月,负责用户调研与需求文档撰写,跟进 3 个功能上线
项目经历:校园活动报名小程序,从 0 到 1 负责需求梳理与原型设计,累计服务 2000+ 用户`;

export const interviewSamples: InterviewQuestionSample[] = [
  {
    id: "backend-behavioral-5",
    description: "后端开发岗位 + 行为面 + 短 5 题:五类各 1 题,经历题锚定简历",
    input: {
      resumeText: backendResume,
      targetPosition: "后端开发工程师",
      interviewType: "行为面",
      questionCount: 5,
      profileSummary: null,
    },
    expectedEvidenceKeywords: ["Python", "MySQL", "后端实习", "二手交易平台"],
    mockOutput: {
      questions: [
        {
          id: "q-1",
          type: "自我介绍",
          question: "请围绕后端开发工程师这个岗位做一个 1 分钟左右的自我介绍,重点说说你与这个岗位最相关的经历。",
          followUpHints: ["追问简历中最亮眼的项目细节", "追问为什么选择后端方向"],
          evidence: [],
        },
        {
          id: "q-2",
          type: "经历深挖",
          question: "你在后端实习 3 个月里,具体负责什么?遇到过的最大困难是什么,怎么解决的?",
          followUpHints: ["追问订单服务接口的具体设计", "追问与前端协作中踩过的坑"],
          evidence: ["后端实习 3 个月,负责订单服务接口开发"],
        },
        {
          id: "q-3",
          type: "技术案例",
          question: "在校园二手交易平台这个项目里,商品发布与订单模块你是怎么设计的?为什么用 MySQL?",
          followUpHints: ["追问表结构设计", "追问并发场景的处理"],
          evidence: ["校园二手交易平台后端,独立完成商品发布与订单模块"],
        },
        {
          id: "q-4",
          type: "情景假设",
          question: "假设你负责的接口在线上出现偶发超时,产品要求当天修复,你会怎么排查和处理?",
          followUpHints: ["追问定位手段", "追问如何与产品沟通预期"],
          evidence: ["负责订单服务接口开发"],
        },
        {
          id: "q-5",
          type: "反问",
          question: "面试接近尾声,你有哪些关于这个岗位或团队的问题想问面试官?",
          followUpHints: ["追问对技术成长空间的关注", "追问对工作节奏的预期"],
          evidence: [],
        },
      ],
    },
  },
  {
    id: "product-behavioral-5",
    description: "产品经理岗位 + 行为面 + 短 5 题:与后端样例题目差异明显(换岗位验证)",
    input: {
      resumeText: productResume,
      targetPosition: "产品经理",
      interviewType: "行为面",
      questionCount: 5,
      profileSummary: null,
    },
    expectedEvidenceKeywords: ["用户调研", "需求文档", "原型设计"],
    mockOutput: {
      questions: [
        {
          id: "q-1",
          type: "自我介绍",
          question: "请围绕产品经理这个岗位做一个 1 分钟左右的自我介绍,重点说说你与产品工作最相关的经历。",
          followUpHints: ["追问最完整的一段产品经历", "追问为什么想做产品"],
          evidence: [],
        },
        {
          id: "q-2",
          type: "经历深挖",
          question: "你在产品实习中跟进 3 个功能上线,挑一个讲讲:需求从哪来、你怎么推动落地的、上线后数据如何?",
          followUpHints: ["追问用户调研的方法", "追问与研发沟通分歧的案例"],
          evidence: ["负责用户调研与需求文档撰写,跟进 3 个功能上线"],
        },
        {
          id: "q-3",
          type: "技术案例",
          question: "校园活动报名小程序从 0 到 1,你的原型设计是怎么做的?如何验证需求真伪?",
          followUpHints: ["追问优先级排序", "追问上线后的数据复盘"],
          evidence: ["从 0 到 1 负责需求梳理与原型设计,累计服务 2000+ 用户"],
        },
        {
          id: "q-4",
          type: "情景假设",
          question: "假设研发告诉你某个需求技术上实现不了,但业务方坚持要做,作为产品经理你会怎么办?",
          followUpHints: ["追问如何拆解真实诉求", "追问如何寻找替代方案"],
          evidence: ["跟进 3 个功能上线"],
        },
        {
          id: "q-5",
          type: "反问",
          question: "面试接近尾声,你有哪些关于这个岗位或团队的问题想问面试官?",
          followUpHints: ["追问对产品方法论成长的关注", "追问对业务方向的理解"],
          evidence: [],
        },
      ],
    },
  },
  {
    id: "backend-technical-10",
    description: "后端开发岗位 + 技术面 + 标准 10 题:五类覆盖 + 技术题补足(echo 10 道)",
    input: {
      resumeText: backendResume,
      targetPosition: "后端开发工程师",
      interviewType: "技术面",
      questionCount: 10,
      profileSummary: null,
    },
    expectedEvidenceKeywords: ["Python", "MySQL", "SQL", "后端实习"],
    mockOutput: {
      questions: [
        {
          id: "q-1",
          type: "自我介绍",
          question: "请围绕后端开发工程师这个岗位做一个 1 分钟左右的自我介绍。",
          followUpHints: ["追问技术栈亮点", "追问实习产出"],
          evidence: [],
        },
        {
          id: "q-2",
          type: "经历深挖",
          question: "后端实习中你负责订单服务接口开发,讲讲接口设计要点与一次典型联调问题。",
          followUpHints: ["追问接口的幂等设计", "追问与前端协作流程"],
          evidence: ["后端实习 3 个月,负责订单服务接口开发与 MySQL 数据表设计"],
        },
        {
          id: "q-3",
          type: "技术案例",
          question: "校园二手交易平台日均请求约 1000 次,你在实现商品发布模块时做过哪些性能或正确性考量?",
          followUpHints: ["追问索引与 SQL 优化", "追问数据一致性处理"],
          evidence: ["校园二手交易平台后端,独立完成商品发布与订单模块"],
        },
        {
          id: "q-4",
          type: "情景假设",
          question: "假设订单服务需要支持秒杀场景,你会从哪些方面重新设计现有实现?",
          followUpHints: ["追问库存扣减方案", "追问流量削峰手段"],
          evidence: [],
        },
        {
          id: "q-5",
          type: "反问",
          question: "面试接近尾声,你有哪些关于这个岗位或团队的问题想问面试官?",
          followUpHints: ["追问团队技术栈细节", "追问新人培养机制"],
          evidence: [],
        },
        {
          id: "q-6",
          type: "技术案例",
          question: "请讲一个你用 Python 解决实际问题的案例:背景、实现思路、踩过的坑。",
          followUpHints: ["追问为何选 Python", "追问性能优化点"],
          evidence: ["Python 熟练"],
        },
        {
          id: "q-7",
          type: "技术案例",
          question: "你在 MySQL 数据表设计中有哪些实践?说说你最满意的一次表设计及其理由。",
          followUpHints: ["追问范式与反范式取舍", "追问慢查询优化经历"],
          evidence: ["MySQL 数据表设计"],
        },
        {
          id: "q-8",
          type: "经历深挖",
          question: "实习期间你与前端、测试协作联调,讲一次跨角色沟通中出现分歧并解决的经历。",
          followUpHints: ["追问你的处理方式", "追问事后的沉淀"],
          evidence: ["与前端、测试协作联调"],
        },
        {
          id: "q-9",
          type: "情景假设",
          question: "假设你发现团队代码库缺少单元测试且无人推动,你会如何循序渐进地改变现状?",
          followUpHints: ["追问切入点选择", "追问如何获得团队支持"],
          evidence: [],
        },
        {
          id: "q-10",
          type: "技术案例",
          question: "用 SQL 熟练自居,请现场描述一个你写过的比较复杂的查询:数据来源、关联逻辑、结果用途。",
          followUpHints: ["追问查询优化过程", "追问索引设计"],
          evidence: ["SQL 熟练"],
        },
      ],
    },
  },
];
