// 隐私政策(5.3):公开页面;内容如实对应当前实现(无自助注销 → 联系删除;简历文件加密存储、可删)。
// 按 5.3 要求声明:服务部署于海外区域,数据在海外部署区域处理。
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "隐私政策 - CareerOS AI" };

const SECTIONS: LegalSection[] = [
  {
    heading: "我们收集的信息",
    paragraphs: [
      "账号信息:昵称、邮箱地址与登录密码的加密哈希值(密码原文不会存储)。",
      "职业画像:你主动填写的教育背景、技能、经历与兴趣目标等信息。",
      "简历内容:你上传或粘贴的简历文件、解析结果与优化版本。",
      "使用记录:AI 分析的运行状态与日志(如分析时间、处理结果)。",
    ],
  },
  {
    heading: "我们如何使用信息",
    paragraphs: [
      "你的信息仅用于提供个性化分析服务:生成职业画像、推荐职业方向、制定成长路线、解析与优化简历。",
      "我们不会将你的信息用于广告投放,不会向第三方出售你的个人信息。",
    ],
  },
  {
    heading: "AI 服务商处理",
    paragraphs: [
      "画像分析、路线图规划与简历优化的相关内容会发送给 AI 模型服务商(DeepSeek、OpenAI 或 Anthropic 之一,依服务配置)以生成分析结果。",
      "上述服务商仅收到生成分析所需的内容,并按照各自的隐私政策处理这些数据。",
    ],
  },
  {
    heading: "数据安全",
    paragraphs: [
      "登录密码以 bcrypt 哈希存储,不以明文保存。",
      "简历文件在存储前经 AES-256 加密(密钥独立配置),传输全程使用 HTTPS。",
      "各账号数据严格隔离,只有登录用户本人可以访问自己的数据。",
    ],
  },
  {
    heading: "数据存储与跨境处理",
    paragraphs: [
      "服务部署于海外地区(美国)的云平台,你的数据存储在海外部署区域并在该区域处理。",
      "我们将采取合理的安全措施保护你的数据;通过使用本服务,你理解并同意上述数据处理方式。",
    ],
  },
  {
    heading: "你的权利",
    paragraphs: [
      "你可以在「简历优化」页的「我的简历」中随时查看、下载与删除自己的简历(删除后文件从存储中移除)。",
      "你可以在「个人设置」中修改昵称与密码。",
      "如需注销账号并删除全部数据,请通过文末联系方式向我们提出,我们将在核实身份后处理。",
    ],
  },
  {
    heading: "Cookie 与本地存储",
    paragraphs: [
      "我们使用必要的登录会话 Cookie(仅限 HttpOnly,不含第三方跟踪 Cookie)来保持你的登录状态。",
    ],
  },
  {
    heading: "政策更新",
    paragraphs: ["本政策可能随服务调整而更新,更新后的版本将发布在本页面并标注更新日期。"],
  },
  {
    heading: "联系我们",
    paragraphs: ["如对本政策有任何疑问,或希望行使你的数据权利,请联系:support@careeros.ai。"],
  },
];

export default function PrivacyPage() {
  return <LegalPage title="隐私政策" updated="2026-08-22" sections={SECTIONS} />;
}
