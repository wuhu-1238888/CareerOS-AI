// 用户协议(5.3):公开页面;含 AI 建议免责声明(产品为 AI 辅助,不替代职业决策)。
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "用户协议 - CareerOS AI" };

const SECTIONS: LegalSection[] = [
  {
    heading: "服务说明",
    paragraphs: [
      "CareerOS AI 是 AI 驱动的职业成长助手,提供职业画像分析、成长路线规划与简历解析优化服务。",
      "本协议在你注册并开始使用本服务时生效。",
    ],
  },
  {
    heading: "账号与使用规范",
    paragraphs: [
      "你需提供真实的邮箱地址注册账号,并妥善保管登录凭证。",
      "你应确保上传的内容合法合规,不包含侵犯他人权益或违反法律法规的信息;不得利用本服务从事任何违法活动。",
      "如发现违规使用,我们有权暂停或终止相关账号的服务。",
    ],
  },
  {
    heading: "AI 建议免责声明",
    paragraphs: [
      "本服务的职业分析与简历建议由 AI 模型生成,仅供你参考,不构成职业决策的担保或承诺。",
      "职业选择、求职决策等重要事项,请结合自身情况独立判断,必要时咨询专业人士。",
      "简历优化结果建议你在导出前自行核对内容的准确性与真实性。",
    ],
  },
  {
    heading: "知识产权",
    paragraphs: [
      "你上传的内容(简历、画像信息)的所有权归你所有。",
      "本服务的软件、界面与文案等知识产权归我们所有,未经许可不得复制、修改或用于商业用途。",
    ],
  },
  {
    heading: "服务变更与终止",
    paragraphs: [
      "我们可能根据发展需要调整或暂停部分功能;如发生重大变更,将通过站内方式提前告知。",
      "你可随时停止使用本服务,并按隐私政策所述方式申请注销账号。",
    ],
  },
  {
    heading: "免责与责任限制",
    paragraphs: [
      "在适用法律允许的最大范围内,我们对因使用本服务产生的间接损失不承担责任;因不可抗力、网络故障、AI 服务商故障等导致的服务中断,我们不承担违约责任,但将尽力恢复服务。",
    ],
  },
  {
    heading: "联系我们",
    paragraphs: ["如对本协议有任何疑问,请联系:support@careeros.ai。"],
  },
];

export default function TermsPage() {
  return <LegalPage title="用户协议" updated="2026-08-22" sections={SECTIONS} />;
}
