// Agent 集中注册(2.3 起):应用启动路径(trpc router)引入本模块即完成登记,Orchestrator 按 intent 路由。
// 3.3 起注册路线 Agent(全量 + 单阶段重生成);4.3 注册简历解析 Agent,4.4 改写,4.6 ATS;6.1 注册岗位匹配 Agent。
import { registry } from "./registry";
import { profileAgent } from "./profile.agent";
import { navigatorAgent, navigatorStageAgent } from "./navigator.agent";
import { resumeAtsAgent, resumeParseAgent, resumeRewriteAgent } from "./resume.agent";
import { matchingAgent } from "./matching.agent";

registry.register(profileAgent);
registry.registerIntent("analyze-profile", "career-profile-analyzer");
registry.register(navigatorAgent);
registry.registerIntent("generate-roadmap", "career-navigator-agent");
registry.register(navigatorStageAgent);
registry.registerIntent("regenerate-stage", "career-navigator-stage-agent");
registry.register(resumeParseAgent);
registry.registerIntent("parse-resume", "resume-parse-agent");
registry.register(resumeRewriteAgent);
registry.registerIntent("rewrite-resume", "resume-rewrite-agent");
registry.register(resumeAtsAgent);
registry.registerIntent("score-ats", "resume-ats-agent");
registry.register(matchingAgent);
registry.registerIntent("analyze-match", "job-matching-agent");

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
export {
  resumeParseAgent,
  resumeRewriteAgent,
  resumeAtsAgent,
  resumeParseAgentInputSchema,
  resumeRewriteAgentInputSchema,
  resumeAtsAgentInputSchema,
} from "./resume.agent";
export type {
  ResumeParseAgentInput,
  ResumeRewriteAgentInput,
  ResumeAtsAgentInput,
} from "./resume.agent";
export { matchingAgent, matchingAgentInputSchema, matchAnalysisSchema } from "./matching.agent";
export type { MatchingAgentInput, MatchAnalysis } from "./matching.agent";
