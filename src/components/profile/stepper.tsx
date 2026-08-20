// 分步表单顶部步进器(2.2,DesignSystem Stepper 规范):完成=绿✓圆、当前=ink、未来=ink-faint;
// 每步展示标题 + 一句「为什么需要」说明(DesignRules 职业画像页要求)
import { cn } from "@/lib/utils";

export type StepperStep = { title: string; why: string };

export function Stepper({ steps, current }: { steps: StepperStep[]; current: number }) {
  return (
    <ol className="flex w-full items-start" aria-label="采集进度">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <li
            key={step.title}
            aria-current={active ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            {/* 圆点 + 连接线:连线位于圆点中线,完成段绿色 */}
            <div className="relative flex h-7 w-full items-center justify-center">
              {!last ? (
                <div
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 h-px -translate-y-1/2",
                    i === 0 ? "left-1/2 right-0" : "inset-x-0",
                    done ? "bg-green-600" : "bg-hairline-strong"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-medium",
                  done && "bg-green-600 text-white",
                  active && "bg-ink text-white",
                  !done && !active && "border border-hairline-strong bg-white text-ink-faint"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
            </div>
            <div className="w-full px-1 text-center">
              <p
                className={cn(
                  "text-body-sm",
                  active || done ? "text-ink" : "text-ink-faint",
                  active && "font-medium"
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-caption text-ink-faint">{step.why}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
