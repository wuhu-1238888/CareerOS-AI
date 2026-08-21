// @vitest-environment node
// Resume Parse Agent 测试(4.3):固定样例集(分区条目数与标注一致、字段忠实不虚构)+
// 边界用例(非法 JSON/违反 Schema/非法输入/进度事件/输入透传)+ 意图注册
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import { resumeParseAgent } from "../resume.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { resumeParseSamples } from "./resume-parse-samples";

describe("Resume Parse Agent 固定样例集", () => {
  for (const sample of resumeParseSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,分区条目数与标注一致`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await resumeParseAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(parsedResumeSchema.safeParse(result.data).success).toBe(true);

      // 基本信息与标注一致
      expect(result.data.basicInfo.name).toBe(sample.expectedName);
      expect(result.data.basicInfo.targetPosition).toBe(sample.expectedTargetPosition);

      // 各分区条目数与标注一致
      expect(result.data.education).toHaveLength(sample.expectedEducationCount);
      expect(result.data.skills).toHaveLength(sample.expectedSkillCount);
      expect(result.data.experiences).toHaveLength(sample.expectedExperienceCount);
      expect(result.data.projects).toHaveLength(sample.expectedProjectCount);

      // 字段忠实:Mock 输出与原文一致(description 为原文语句拼接)
      const raw = sample.input.resumeText;
      for (const edu of result.data.education) {
        expect(raw).toContain(edu.school);
      }
      for (const exp of result.data.experiences) {
        expect(raw).toContain(exp.company);
      }
      for (const line of result.data.experiences.flatMap((e) => e.description.split("\n"))) {
        expect(raw.replace(/\s+/g, " ")).toContain(line.replace(/\s+/g, " ").trim());
      }

      // 输入数据确实传给了模型(原文内容进入 user 消息)
      expect(capturedUserMessage).toContain(sample.expectedName);
      expect(capturedUserMessage).toContain(sample.expectedTargetPosition);
    });
  }

  it("同一输入执行两次:输出结构一致", async () => {
    const sample = resumeParseSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const first = await resumeParseAgent.execute(sample.input, {}, { adapter });
    const second = await resumeParseAgent.execute(sample.input, {}, { adapter });
    expect(second.data).toEqual(first.data);
  });
});

describe("Resume Parse Agent 边界用例", () => {
  const sample = resumeParseSamples[0]!;

  it("模型输出非法 JSON → AgentOutputError", async () => {
    const adapter = new MockAdapter(0, () => "抱歉,我无法输出 JSON。");
    await expect(resumeParseAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反 Schema(教育条目缺学校)→ AgentOutputError", async () => {
    const invalid = {
      ...sample.mockOutput,
      education: [{ degree: "本科", major: "计算机", timeRange: { start: "2016-09", end: "2020-06" } }],
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(resumeParseAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(原文过短)→ AgentInputError", async () => {
    await expect(
      resumeParseAgent.execute({ resumeText: "太短" }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const stages: string[] = [];
    await resumeParseAgent.execute(sample.input, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Resume Parse Agent 注册(4.3)", () => {
  it("intent parse-resume 路由到 Resume Parse Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("parse-resume").config.name).toBe("resume-parse-agent");
    expect(registry.get("resume-parse-agent")).toBe(resumeParseAgent);
  });
});
