// BaseAgent 基类(1.6):所有 Agent 继承本类,获得统一的生命周期推进、Zod 校验与进度事件。
// 执行流:start(启动)→ prompt(组织上下文)→ llm(一次性补全)→ parse(解析+校验)→ done,最终一次性 JSON。
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ChatMessage, LLMAdapter } from "@/lib/llm/adapter";
import { llm } from "@/lib/llm";
import type {
  AgentConfig,
  AgentContext,
  AgentProgress,
  AgentResult,
  ProgressCallback,
  StreamEvent,
} from "./types";
import { AgentInputError, AgentOutputError } from "./types";

// Prompt 文件加载(相对 src/lib/prompts 的 Markdown,进程内缓存)
const promptCache = new Map<string, string>();

export function loadPrompt(relPath: string): string {
  const cached = promptCache.get(relPath);
  if (cached !== undefined) return cached;
  const content = readFileSync(path.join(process.cwd(), "src/lib/prompts", relPath), "utf-8");
  promptCache.set(relPath, content);
  return content;
}

// 容错 JSON 提取:纯 JSON → ```json 围栏 → 首尾花括号截取;全部失败抛错(由 parseOutput 转为 AgentOutputError)
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // 继续尝试容错提取
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // 继续
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // 落到下方统一抛错
    }
  }
  throw new Error("无法从模型输出中提取 JSON");
}

export interface AgentExecuteOptions {
  adapter?: LLMAdapter;
  onProgress?: ProgressCallback;
}

export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  abstract readonly config: AgentConfig;

  /** 组装发给 LLM 的消息(不含 system;system 由基类从 Prompt 文件加载) */
  abstract buildMessages(input: TInput, context: AgentContext): ChatMessage[];

  protected systemPrompt(): string {
    return loadPrompt(this.config.promptPath);
  }

  /**
   * 流式执行:逐条产出生命周期进度事件,最后一条为最终结果。
   * 进度同时经 onProgress 回调转发,因此 execute() 与 executeStream() 共享同一执行路径。
   */
  async *executeStream(
    input: TInput,
    context: AgentContext,
    options?: AgentExecuteOptions
  ): AsyncGenerator<StreamEvent<TOutput>> {
    const { adapter = llm, onProgress } = options ?? {};
    const startedAt = Date.now();
    const emit = (progress: AgentProgress) => {
      onProgress?.(progress);
    };

    const validatedInput = this.validateInput(input);

    const startEvent: AgentProgress = { stage: "start", message: `正在启动「${this.config.name}」…` };
    emit(startEvent);
    yield { type: "progress", progress: startEvent };

    const messages: ChatMessage[] = [
      { role: "system", content: this.systemPrompt() },
      ...this.buildMessages(validatedInput, context),
    ];

    const promptEvent: AgentProgress = { stage: "prompt", message: "正在理解你的背景与目标…" };
    emit(promptEvent);
    yield { type: "progress", progress: promptEvent };

    const llmEvent: AgentProgress = { stage: "llm", message: "正在分析…" };
    emit(llmEvent);
    yield { type: "progress", progress: llmEvent };
    const llmResult = await adapter.complete(messages, this.llmOptions());

    const parseEvent: AgentProgress = { stage: "parse", message: "正在整理分析结果…" };
    emit(parseEvent);
    yield { type: "progress", progress: parseEvent };
    const data = this.parseOutput(llmResult.text);

    const doneEvent: AgentProgress = { stage: "done", message: "分析完成" };
    emit(doneEvent);
    yield { type: "progress", progress: doneEvent };

    const result: AgentResult<TOutput> = {
      data,
      model: llmResult.model,
      usage: llmResult.usage,
      durationMs: Date.now() - startedAt,
    };
    yield { type: "result", result };
  }

  /** 一次性执行:走同一流式路径,返回最终结果;进度经 options.onProgress 增量回调 */
  async execute(
    input: TInput,
    context: AgentContext,
    options?: AgentExecuteOptions
  ): Promise<AgentResult<TOutput>> {
    let lastResult: AgentResult<TOutput> | undefined;
    for await (const event of this.executeStream(input, context, options)) {
      if (event.type === "result") lastResult = event.result;
    }
    if (!lastResult) {
      throw new AgentOutputError(this.config.name, "", "执行未产出结果");
    }
    return lastResult;
  }

  private validateInput(input: TInput): TInput {
    const parsed = this.config.inputSchema.safeParse(input);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(根)"}: ${issue.message}`)
        .join("; ");
      throw new AgentInputError(this.config.name, details);
    }
    return parsed.data as TInput;
  }

  private parseOutput(text: string): TOutput {
    let raw: unknown;
    try {
      raw = extractJson(text);
    } catch {
      throw new AgentOutputError(this.config.name, text, "输出不是合法 JSON");
    }
    const parsed = this.config.outputSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(根)"}: ${issue.message}`)
        .join("; ");
      throw new AgentOutputError(this.config.name, text, details);
    }
    return parsed.data as TOutput;
  }

  private llmOptions() {
    const options: { model?: string; temperature?: number } = {};
    if (this.config.model) options.model = this.config.model;
    if (this.config.temperature !== undefined) options.temperature = this.config.temperature;
    return Object.keys(options).length > 0 ? options : undefined;
  }
}
