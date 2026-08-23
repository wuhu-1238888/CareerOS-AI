// 固定样例集(6.1):3 份手工标注的岗位匹配输入 + 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、JD 拆解与标注一致、纯英文 JD 正常处理、无画像降级形态正确。
// 真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1),本样例集保证管线正确性。
import type { MatchingAgentInput, MatchAnalysis } from "../matching.agent";

export type MatchingSample = {
  id: string;
  description: string;
  input: MatchingAgentInput;
  /** 标注:期望出现在岗位要求文本中的关键词(至少一个) */
  expectedRequirementKeywords: string[];
  /** 标注:期望整体匹配度范围;null 表示无画像降级(overallScore 应为 null) */
  expectedScoreRange: [number, number] | null;
  /** 手工构造的 Mock 输出(需通过 outputSchema,且与标注一致) */
  mockOutput: MatchAnalysis;
};

const backendJd = `【后端开发工程师(校招)】
岗位职责:
1. 负责公司核心业务系统的后端服务设计与开发,参与需求评审与技术方案设计;
2. 与前端、测试协作,保障接口质量与交付进度;
3. 参与线上问题定位与性能优化。
任职要求:
1. 本科及以上学历,计算机相关专业;
2. 熟悉 Python 或 Java,了解常用数据结构与算法;
3. 熟悉 MySQL、Redis 等常用存储,了解 Linux 基本操作;
4. 有实习或项目经验者优先;具备良好的沟通协作能力,能承受一定的工作压力。`;

const englishJd = `Software Engineer - Backend (New Grad)
About the role:
We are looking for a backend engineer to build services powering our platform.
Responsibilities:
- Design and implement scalable REST APIs and data pipelines
- Collaborate with product and frontend teams in an agile environment
- Write unit tests and participate in code reviews
Requirements:
- Bachelor's degree in Computer Science or related field
- Proficiency in Python or Java, solid understanding of data structures and algorithms
- Experience with MySQL, Redis, and Linux environments
- Strong communication skills and a growth mindset are a plus`;

const shortJd = `招聘新媒体运营实习生:负责公众号内容排版与发布,要求熟悉微信公众号后台,文字功底好。`;

export const matchingSamples: MatchingSample[] = [
  {
    id: "backend-with-profile",
    description: "中文后端 JD + 完整画像:正常对比输出",
    input: {
      jdText: backendJd,
      profileSummary:
        "计算机专业应届生,Python 熟练、SQL 熟练、JavaScript 基础;两段开发经历(后端实习 3 个月、校园二手交易平台后端);目标后端开发工程师;雷达:产品 40/技术 80/数据 68/沟通 50/项目 66/行业 45。",
      optimizedResumeText: null,
      feedback: [],
    },
    expectedRequirementKeywords: ["Python", "MySQL"],
    expectedScoreRange: [0, 100],
    mockOutput: {
      positionTitle: "后端开发工程师",
      summary:
        "技术栈与实习经历与岗位要求基本匹配,缺少高并发实战与深度项目经验,建议针对短板补课后投递。",
      requirements: [
        { id: "req-1", text: "本科及以上学历,计算机相关专业", category: "显性", importance: 4 },
        { id: "req-2", text: "熟悉 Python 或 Java,了解数据结构与算法", category: "显性", importance: 5 },
        { id: "req-3", text: "熟悉 MySQL、Redis 等常用存储与 Linux 基本操作", category: "显性", importance: 4 },
        { id: "req-4", text: "有实习或项目经验", category: "显性", importance: 4 },
        { id: "req-5", text: "良好的沟通协作能力,能承受工作压力", category: "隐性", importance: 3 },
      ],
      items: [
        {
          requirementId: "req-1",
          status: "达标",
          matchType: "直接",
          userEvidence: "计算机科学与技术专业本科在读",
          gap: "无明显差距",
        },
        {
          requirementId: "req-2",
          status: "达标",
          matchType: "直接",
          userEvidence: "Python 熟练,两段后端开发经历均使用 Python",
          gap: "无明显差距",
        },
        {
          requirementId: "req-3",
          status: "接近",
          matchType: "间接",
          userEvidence: "SQL 熟练,实习中接触过 MySQL;Redis 与 Linux 仅课程了解",
          gap: "缺少 Redis 与 Linux 的工程实践经验",
        },
        {
          requirementId: "req-4",
          status: "达标",
          matchType: "直接",
          userEvidence: "后端实习 3 个月 + 校园二手交易平台后端开发",
          gap: "无明显差距",
        },
        {
          requirementId: "req-5",
          status: "接近",
          matchType: "可迁移",
          userEvidence: "实习中与前端、测试协作联调,团队协作基础良好",
          gap: "沟通协作证据有限,压力场景经历未体现",
        },
      ],
      overallScore: 78,
      recommendation: {
        level: "建议补课后投递",
        reason: "核心技术要求达标,存储与高并发实战经验偏弱,补一两个工程实践项目后可投递",
      },
      jobRadar: { 产品: 30, 技术: 90, 数据: 55, 沟通: 60, 项目: 70, 行业: 40 },
      resumeSuggestions: [
        { requirementId: "req-3", suggestion: "补充 Redis 与 Linux 相关课程或实验经历,突出 SQL 实践" },
        { requirementId: "req-5", suggestion: "补充一次跨团队协作或项目推进中解决分歧的案例" },
      ],
    },
  },
  {
    id: "english-jd",
    description: "纯英文 JD + 画像:拆解正常,输出中文",
    input: {
      jdText: englishJd,
      profileSummary:
        "计算机专业应届生,Python 熟练、SQL 熟练;后端实习 3 个月;目标后端开发工程师。",
      optimizedResumeText: null,
      feedback: [],
    },
    expectedRequirementKeywords: ["Python", "MySQL"],
    expectedScoreRange: [0, 100],
    mockOutput: {
      positionTitle: "后端软件工程师",
      summary: "英文 JD 拆解正常,技术栈与岗位要求基本匹配,缺少数仓管道与单元测试相关实践。",
      requirements: [
        { id: "req-1", text: "计算机相关专业本科学历", category: "显性", importance: 4 },
        { id: "req-2", text: "熟练 Python 或 Java,掌握数据结构与算法", category: "显性", importance: 5 },
        { id: "req-3", text: "有 MySQL、Redis 与 Linux 环境使用经验", category: "显性", importance: 4 },
        { id: "req-4", text: "较强的沟通能力与成长型思维", category: "隐性", importance: 3 },
      ],
      items: [
        {
          requirementId: "req-1",
          status: "达标",
          matchType: "直接",
          userEvidence: "计算机专业本科在读",
          gap: "无明显差距",
        },
        {
          requirementId: "req-2",
          status: "达标",
          matchType: "直接",
          userEvidence: "Python 熟练,后端实习中使用 Python 开发接口",
          gap: "无明显差距",
        },
        {
          requirementId: "req-3",
          status: "接近",
          matchType: "间接",
          userEvidence: "SQL 熟练,实习接触 MySQL;Redis 与 Linux 仅有课程了解",
          gap: "缺少 Redis 与 Linux 工程实践",
        },
        {
          requirementId: "req-4",
          status: "接近",
          matchType: "可迁移",
          userEvidence: "实习期间参与团队协作与代码评审流程",
          gap: "成长型思维缺乏直接证据",
        },
      ],
      overallScore: 75,
      recommendation: {
        level: "建议补课后投递",
        reason: "核心编程要求达标,存储与工程化实践偏弱,建议补齐后投递",
      },
      jobRadar: { 产品: 25, 技术: 88, 数据: 50, 沟通: 55, 项目: 65, 行业: 35 },
      resumeSuggestions: [
        { requirementId: "req-3", suggestion: "简历补充 MySQL 项目细节,突出 SQL 调优实践" },
      ],
    },
  },
  {
    id: "no-profile",
    description: "短 JD + 无画像:仅拆解降级形态",
    input: {
      jdText: shortJd,
      profileSummary: null,
      optimizedResumeText: null,
      feedback: [],
    },
    expectedRequirementKeywords: ["公众号"],
    expectedScoreRange: null,
    mockOutput: {
      positionTitle: "新媒体运营实习生",
      summary:
        "仅基于 JD 的岗位要求拆解,完成职业画像后可查看完整匹配分析。",
      requirements: [
        { id: "req-1", text: "负责公众号内容排版与发布", category: "显性", importance: 4 },
        { id: "req-2", text: "熟悉微信公众号后台", category: "显性", importance: 5 },
        { id: "req-3", text: "文字功底好", category: "隐性", importance: 4 },
      ],
      items: [],
      overallScore: null,
      recommendation: null,
      jobRadar: { 产品: 45, 技术: 25, 数据: 30, 沟通: 40, 项目: 50, 行业: 55 },
      resumeSuggestions: [],
    },
  },
];
