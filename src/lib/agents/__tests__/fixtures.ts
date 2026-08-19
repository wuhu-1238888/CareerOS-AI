// 测试夹具(1.6):最小样例 Agent + 固定回复。真实三 Agent 于 2.3/3.3/4.3 实现。
import { z } from "zod";
import { BaseAgent } from "../base";
import type { AgentConfig, AgentContext } from "../types";
import type { ChatMessage } from "@/lib/llm/adapter";

export const summaryOutputSchema = z.object({
  summary: z.string().min(1),
  keywords: z.array(z.string()).min(1),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

export class SummaryAgent extends BaseAgent<{ text: string }, SummaryOutput> {
  readonly config: AgentConfig = {
    name: "sample-summary",
    description: "样例:生成背景摘要(1.6 测试夹具)",
    promptPath: "sample-analyst.md",
    inputSchema: z.object({ text: z.string().min(1) }),
    outputSchema: summaryOutputSchema,
    temperature: 0.2,
  };

  buildMessages(input: { text: string }, context: AgentContext): ChatMessage[] {
    return [{ role: "user", content: JSON.stringify({ text: input.text, context }) }];
  }
}

export const VALID_JSON_REPLY = JSON.stringify({
  summary: "计算机专业大三学生,目标后端开发",
  keywords: ["Java", "后端", "实习"],
});

export const DEFAULT_CONTEXT: AgentContext = { userId: "u-test" };
