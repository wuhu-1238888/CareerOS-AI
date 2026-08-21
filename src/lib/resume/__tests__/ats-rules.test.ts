// @vitest-environment node
// ATS 规则评分测试(4.6):同输入两次恒等(纯函数确定性)/ 六子分边界 / 固定权重合成 / 三档等级映射。
// 规则侧确定性是「两次评分分差 ≤10」验收的稳定基础(LLM 侧另有温度 0 + 5 分档)。
import { describe, expect, it } from "vitest";
import type { AtsRuleSubscores } from "@/lib/resume/analysis-schemas";
import { computeRuleScore, scoreRuleSubscores, synthesizeAtsScore } from "../ats-rules";

// 五节齐全 + 量化行 + 方向关键词 + 动词开头 + 长度适中 + 无格式问题的理想文本
const idealResume = [
  "张伟",
  "电话:138-0000-0000 邮箱:zhangwei@example.com 求职意向:后端开发工程师",
  "教育经历",
  "2016-09 至 2020-06 中国科学技术大学 计算机科学与技术 本科 毕业",
  "技能",
  "熟练 Java、Spring、MySQL,掌握 Redis、分布式,Linux",
  "工作经历",
  "2021-07 至今 杭州某科技有限公司 后端开发工程师",
  "负责电商订单系统开发,日均处理订单 50 万笔",
  "主导缓存层优化,接口响应时间降低 40%",
  "项目经历",
  "Project:分布式秒杀系统",
  "搭建微服务网关,承载峰值流量 10 万 QPS",
].join("\n");

const full: AtsRuleSubscores = {
  sections: 100,
  quantified: 100,
  keywords: 100,
  actionVerbs: 100,
  length: 100,
  parseability: 100,
};

describe("scoreRuleSubscores 六子分", () => {
  it("同输入两次恒等(纯函数,无随机无模型)", () => {
    const first = scoreRuleSubscores(idealResume, "后端开发工程师");
    const second = scoreRuleSubscores(idealResume, "后端开发工程师");
    expect(first).toEqual(second);
  });

  it("分节完整性:五节各 20 分;缺教育/技能 → 60", () => {
    expect(scoreRuleSubscores(idealResume, "后端开发工程师").sections).toBe(100);
    const bare = "张伟\n电话 123\n工作经历\n负责订单开发\n项目经历\n";
    expect(scoreRuleSubscores(bare, "后端开发工程师").sections).toBe(60);
  });

  it("量化密度:数字+单位行占比 30% 以上满分;无量化行 0", () => {
    const text = [
      "张伟",
      "电话 123",
      "负责订单系统开发,日均处理订单 50 万笔",
      "主导缓存优化,响应时间降低 40%",
      "搭建网关",
    ].join("\n");
    // 5 行内容中 2 行含数字+单位 → 40% ≥ 30% → 满分
    expect(scoreRuleSubscores(text, "后端开发工程师").quantified).toBe(100);
    const noDigits = ["张伟", "负责订单系统开发", "参与缓存优化"].join("\n");
    expect(scoreRuleSubscores(noDigits, "后端开发工程师").quantified).toBe(0);
  });

  it("关键词覆盖:方向词典命中数/5 满分;未命中方向回退通用词典", () => {
    expect(scoreRuleSubscores(idealResume, "后端开发工程师").keywords).toBe(100);
    // Java/Spring/MySQL 3 词 → 60
    const sparse = "张伟\n技能\nJava、Spring、MySQL\n工作经历\n负责订单系统开发\n";
    expect(scoreRuleSubscores(sparse, "后端开发工程师").keywords).toBe(60);
    // 未知方向 → 通用词典(仅「负责」命中 1 词 → 20)
    const generic = "张伟\n负责订单系统\n";
    expect(scoreRuleSubscores(generic, "量子计算").keywords).toBe(20);
  });

  it("动词开头:去项目符号后以动作动词开头的行占比", () => {
    const verbs = ["负责订单系统开发", "主导缓存优化", "推动服务治理"].join("\n");
    expect(scoreRuleSubscores(verbs, "后端开发工程师").actionVerbs).toBe(100);
    // 项目符号被剥离后仍以动词开头
    const bullets = ["- 负责订单系统开发", "• 主导缓存优化"].join("\n");
    expect(scoreRuleSubscores(bullets, "后端开发工程师").actionVerbs).toBe(100);
    const none = ["订单系统开发相关", "缓存优化相关工作"].join("\n");
    expect(scoreRuleSubscores(none, "后端开发工程师").actionVerbs).toBe(0);
  });

  it("长度篇幅:500-1200 满分带;400 字 → 80;1500 字 → 90", () => {
    expect(scoreRuleSubscores("字".repeat(600), "后端开发工程师").length).toBe(100);
    expect(scoreRuleSubscores("字".repeat(400), "后端开发工程师").length).toBe(80);
    expect(scoreRuleSubscores("字".repeat(1500), "后端开发工程师").length).toBe(90);
  });

  it("格式可解析性:可疑符号/连续空行/Tab 各自扣分,下限 0", () => {
    expect(scoreRuleSubscores("张伟\n负责订单系统开发", "后端开发工程师").parseability).toBe(100);
    // emoji 1 个(-5)+ 连续空行 1 处(-10)+ Tab 1 个(-5)= 80
    const messy = "张伟\n\n\n负责\t订单😀开发";
    expect(scoreRuleSubscores(messy, "后端开发工程师").parseability).toBe(80);
    // 21 个可疑符号 × 5 = -105 → 下限 0
    expect(scoreRuleSubscores("😀".repeat(21), "后端开发工程师").parseability).toBe(0);
  });
});

describe("computeRuleScore / synthesizeAtsScore 合成与等级", () => {
  it("固定权重加权:全 100 → 100;混合子分按权重计算", () => {
    expect(computeRuleScore(full)).toBe(100);
    const mixed: AtsRuleSubscores = {
      sections: 100,
      quantified: 50,
      keywords: 0,
      actionVerbs: 0,
      length: 0,
      parseability: 0,
    };
    // 0.2×100 + 0.2×50 = 30
    expect(computeRuleScore(mixed)).toBe(30);
  });

  it("合成 6:4 权重:规则 100 + LLM(5,5)→ 100 优秀;LLM(3,3)→ 84", () => {
    expect(synthesizeAtsScore(full, { contentQuality: 5, relevance: 5 })).toEqual({
      ruleScore: 100,
      total: 100,
      level: "优秀",
    });
    expect(synthesizeAtsScore(full, { contentQuality: 3, relevance: 3 }).total).toBe(84);
  });

  it("三档等级边界:80 → 优秀;76/60 → 良好;56/44 → 需改进", () => {
    const rule80: AtsRuleSubscores = {
      sections: 80,
      quantified: 80,
      keywords: 80,
      actionVerbs: 80,
      length: 80,
      parseability: 80,
    };
    // 规则 100 + LLM(3,2)→ llm 50 → 60+20 = 80 → 优秀(上边界)
    expect(synthesizeAtsScore(full, { contentQuality: 3, relevance: 2 })).toEqual({
      ruleScore: 100,
      total: 80,
      level: "优秀",
    });
    // 规则 100 + LLM(2,2)→ 76 → 良好
    expect(synthesizeAtsScore(full, { contentQuality: 2, relevance: 2 }).level).toBe("良好");
    // 规则 80 + LLM(2,1)→ 60 → 良好(下边界)
    expect(synthesizeAtsScore(rule80, { contentQuality: 2, relevance: 1 }).total).toBe(60);
    expect(synthesizeAtsScore(rule80, { contentQuality: 2, relevance: 1 }).level).toBe("良好");
    // 规则 80 + LLM(1,1)→ 56 → 需改进
    expect(synthesizeAtsScore(rule80, { contentQuality: 1, relevance: 1 }).level).toBe("需改进");
    // 规则 60 + LLM(1,1)→ 44 → 需改进
    const rule60: AtsRuleSubscores = {
      sections: 60,
      quantified: 60,
      keywords: 60,
      actionVerbs: 60,
      length: 60,
      parseability: 60,
    };
    expect(synthesizeAtsScore(rule60, { contentQuality: 1, relevance: 1 }).total).toBe(44);
  });
});
