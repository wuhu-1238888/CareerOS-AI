// 页面头组件:标题 + 描述 + 右侧主行动槽(所有模块页统一结构)
export interface PageHeaderProps {
  title: string;
  description?: string;
  /** 右侧操作区(主按钮等) */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-h1 text-ink">{title}</h1>
        {description ? <p className="text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
