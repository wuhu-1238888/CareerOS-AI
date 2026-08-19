// Agent 基座共享类型(1.6):配置 / 进度事件 / 结果 / 领域错误
import type { z } from "zod";

/** Agent 上下文:执行间透传的自由键值(画像、路线图等产物,信封结构见 orchestration/context.ts) */
export type AgentContext = Record<string, unknown>;

export interface AgentConfig {
  /** 全局唯一 Agent 名,也是 intent 路由的默认匹配键,如 "career-profile-analyzer" */
  name: string;
  /** 人类可读描述,用于注册表清单与日志 */
  description: string;
  /** Prompt 文件相对路径(相对 src/lib/prompts),Markdown 解耦,见 technical-design 6.1 */
  promptPath: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  /** 模型名(缺省用适配器默认模型) */
  model?: string;
  temperature?: number;
}

/**
 * 生命周期进度事件:确定性文案(「正在理解你的背景…」),非 LLM 逐字流。
 * 已确认决策:流式 = Agent 生命周期确定性进度 + 最终一次性 JSON(见 technical-design 6.3)
 */
export interface AgentProgress {
  stage: "start" | "prompt" | "llm" | "parse" | "done";
  message: string;
}

export type ProgressCallback = (progress: AgentProgress) => void;

export interface AgentResult<TOutput> {
  /** 已通过 outputSchema 校验的数据(JSON 安全,可直接入库) */
  data: TOutput;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

/** 流式执行的产出:进度事件或最终结果 */
export type StreamEvent<TOutput> =
  | { type: "progress"; progress: AgentProgress }
  | { type: "result"; result: AgentResult<TOutput> };

/** 输入未通过 inputSchema(业务上调用方应先行校验,此错误兜底) */
export class AgentInputError extends Error {
  constructor(agentName: string, details: string) {
    super(`Agent「${agentName}」输入不符合要求:${details}`);
    this.name = "AgentInputError";
  }
}

/** 输出无法解析为 JSON 或未通过 outputSchema(保留原始文本供排查,展示层只给友好文案) */
export class AgentOutputError extends Error {
  readonly agentName: string;
  readonly rawText: string;

  constructor(agentName: string, rawText: string, details: string) {
    super(`Agent「${agentName}」输出未通过校验:${details}`);
    this.name = "AgentOutputError";
    this.agentName = agentName;
    this.rawText = rawText;
  }
}

/** 注册表中不存在支持该意图的 Agent */
export class AgentNotFoundError extends Error {
  constructor(intent: string) {
    super(`未注册支持意图「${intent}」的 Agent`);
    this.name = "AgentNotFoundError";
  }
}
