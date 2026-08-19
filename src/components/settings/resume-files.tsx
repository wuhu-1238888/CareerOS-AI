// 简历文件管理区块(1.8):4.1 存储抽象与简历模块(M4)上线前展示空态,不报错
import { FileText } from "lucide-react";

export function ResumeFiles() {
  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h2 className="text-body-lg font-medium text-ink">简历文件管理</h2>
      <p className="mt-1 text-body-sm text-ink-muted">管理你上传的简历文件与解析记录</p>

      <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline-strong bg-sunken px-6 py-10 text-center">
        <FileText className="size-8 text-ink-faint" aria-hidden />
        <p className="text-body-sm font-medium text-ink-secondary">暂无简历文件</p>
        <p className="text-caption text-ink-muted">简历文件上传将在简历优化模块(M4)上线后开放</p>
      </div>
    </section>
  );
}
