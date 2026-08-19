// 模块占位卡片(1.7):四个模块页在对应里程碑前统一呈现建设中文案
export interface ModulePlaceholderProps {
  moduleName: string;
  /** 预期里程碑,如 "M2" */
  milestone: string;
}

export function ModulePlaceholder({ moduleName, milestone }: ModulePlaceholderProps) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-10 shadow-card">
      <p className="text-body-lg font-medium text-ink">{moduleName}</p>
      <p className="mt-2 text-body-sm text-ink-muted">该模块正在建设中,将在里程碑 {milestone} 与你见面。</p>
    </div>
  );
}
