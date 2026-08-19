// Agent 注册表(1.6):名称登记 + 意图路由。真实三 Agent(2.3 画像 / 3.3 路线 / 4.3 简历)后续在此注册。
import type { BaseAgent } from "./base";
import type { AgentConfig } from "./types";
import { AgentNotFoundError } from "./types";

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private intents = new Map<string, string>();

  /** 登记 Agent(同名覆盖,后注册生效) */
  register(agent: BaseAgent): void {
    this.agents.set(agent.config.name, agent);
  }

  /** 显式声明意图 → Agent 路由(缺省约定:Agent 名即意图) */
  registerIntent(intent: string, agentName: string): void {
    this.intents.set(intent, agentName);
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  list(): AgentConfig[] {
    return Array.from(this.agents.values()).map((agent) => agent.config);
  }

  /** 按意图路由:显式意图表优先,否则按 Agent 名匹配;未命中抛 AgentNotFoundError */
  findByIntent(intent: string): BaseAgent {
    const agentName = this.intents.get(intent) ?? intent;
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new AgentNotFoundError(intent);
    }
    return agent;
  }
}

/** 全局单例:业务路由(Orchestrator 默认使用) */
export const registry = new AgentRegistry();
