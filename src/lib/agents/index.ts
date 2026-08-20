// Agent 集中注册(2.3 起):应用启动路径(trpc router)引入本模块即完成登记,Orchestrator 按 intent 路由。
// 后续 3.3 路线 Agent / 4.3 简历 Agent 在此追加。
import { registry } from "./registry";
import { profileAgent } from "./profile.agent";

registry.register(profileAgent);
registry.registerIntent("analyze-profile", "career-profile-analyzer");

export { registry };
export { profileAgent, profileAnalysisSchema, profileRadarSchema } from "./profile.agent";
export type { ProfileAnalysis, ProfileAgentInput, ProfileRadar } from "./profile.agent";
