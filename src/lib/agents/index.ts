// Agent 集中注册(2.3 起):应用启动路径(trpc router)引入本模块即完成登记,Orchestrator 按 intent 路由。
// 3.3 起注册路线 Agent(全量 + 单阶段重生成);4.3 简历 Agent 在此追加。
import { registry } from "./registry";
import { profileAgent } from "./profile.agent";
import { navigatorAgent, navigatorStageAgent } from "./navigator.agent";

registry.register(profileAgent);
registry.registerIntent("analyze-profile", "career-profile-analyzer");
registry.register(navigatorAgent);
registry.registerIntent("generate-roadmap", "career-navigator-agent");
registry.register(navigatorStageAgent);
registry.registerIntent("regenerate-stage", "career-navigator-stage-agent");

export { registry };
export { profileAgent, profileAnalysisSchema, profileRadarSchema } from "./profile.agent";
export type { ProfileAnalysis, ProfileAgentInput, ProfileRadar } from "./profile.agent";
export {
  navigatorAgent,
  navigatorStageAgent,
  navigatorAgentInputSchema,
  navigatorStageAgentInputSchema,
  roadmapAnalysisSchema,
  roadmapStageSchema,
} from "./navigator.agent";
export type {
  NavigatorAgentInput,
  NavigatorStageAgentInput,
  RoadmapAnalysis,
  RoadmapStage,
} from "./navigator.agent";
