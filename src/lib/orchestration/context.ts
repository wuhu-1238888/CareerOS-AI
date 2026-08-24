// 全局上下文信封(1.6):所有 Agent 共享数据统一携带版本号、来源 Agent、生成时间(自 Phase 1 写入)
export const GLOBAL_CONTEXT_VERSION = "1.0";

// type 别名而非 interface:信封需作为 AgentContext(Record<string, unknown>)透传,
// interface 缺少隐式索引签名会导致赋值报错(8.1a 注入派生上下文时踩到)
export type GlobalContext = {
  /** 上下文 schema 版本,跨 Agent 产物演进时升版本 */
  version: string;
  /** 产生该上下文的 Agent 名(人工录入类上下文记为 "user") */
  sourceAgent: string;
  /** 生成时间(ISO 8601) */
  generatedAt: string;
  data: Record<string, unknown>;
};

export function buildContext(sourceAgent: string, data: Record<string, unknown>): GlobalContext {
  return {
    version: GLOBAL_CONTEXT_VERSION,
    sourceAgent,
    generatedAt: new Date().toISOString(),
    data,
  };
}

/** 基于上游产物合并新数据:data 浅合并,来源与时间戳更新为新 Agent */
export function mergeContext(
  prev: GlobalContext,
  patch: Record<string, unknown>,
  sourceAgent: string
): GlobalContext {
  return buildContext(sourceAgent, { ...prev.data, ...patch });
}
