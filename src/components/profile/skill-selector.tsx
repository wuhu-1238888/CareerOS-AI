"use client";
// 技能选择器(2.2):预设技能 chips + 自由输入 + 三点熟练度分级(DesignSystem 技能三点系统 ●●○ + 文字)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SKILL_PRESETS } from "@/lib/profile/skill-presets";
import { cn } from "@/lib/utils";
import type { z } from "zod";
import type { skillEntrySchema } from "@/lib/profile/schemas";

type SkillEntry = z.infer<typeof skillEntrySchema>;

export const SKILL_LEVELS = [
  { level: "基础", dots: "●○○" },
  { level: "熟练", dots: "●●○" },
  { level: "精通", dots: "●●●" },
] as const;

const MAX_SKILLS = 20;

export function SkillSelector({
  value,
  onChange,
  error,
}: {
  value: SkillEntry[];
  onChange: (value: SkillEntry[]) => void;
  error?: string;
}) {
  const [input, setInput] = useState("");

  function addSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.some((s) => s.name === trimmed)) return;
    onChange([...value, { name: trimmed, level: "熟练" }]);
    setInput("");
  }

  function setLevel(name: string, level: SkillEntry["level"]) {
    onChange(value.map((s) => (s.name === name ? { ...s, level } : s)));
  }

  function remove(name: string) {
    onChange(value.filter((s) => s.name !== name));
  }

  return (
    <div className="space-y-4">
      {/* 预设技能 chips:点击添加/移除 */}
      <div>
        <Label>选择技能</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SKILL_PRESETS.map((preset) => {
            const selected = value.some((s) => s.name === preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => (selected ? remove(preset) : addSkill(preset))}
                className={cn(
                  "rounded-pill border px-3 py-1 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-green-600 bg-green-100 text-ink"
                    : "border-hairline-strong bg-white text-ink-muted hover:border-ink-faint"
                )}
              >
                {selected ? "✓ " : ""}
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* 自由输入:回车或点击添加 */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="skill-input">添加其他技能</Label>
          <Input
            id="skill-input"
            type="text"
            placeholder="输入技能名称,如 Go、Figma"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(input);
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-7"
          onClick={() => addSkill(input)}
          disabled={!input.trim()}
        >
          添加
        </Button>
      </div>

      {/* 已选技能:名称 + 三点熟练度 + 移除 */}
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((skill) => (
            <li
              key={skill.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-hairline bg-sunken px-3 py-2"
            >
              <span className="text-body-sm text-ink">{skill.name}</span>
              <span className="flex items-center gap-2">
                <span role="group" aria-label={`${skill.name}熟练度`} className="flex items-center gap-1">
                  {SKILL_LEVELS.map((option) => {
                    const active = skill.level === option.level;
                    return (
                      <button
                        key={option.level}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setLevel(skill.name, option.level)}
                        className={cn(
                          "rounded-control border px-2 py-0.5 text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          active
                            ? "border-green-600 text-green-600"
                            : "border-hairline text-ink-faint hover:border-ink-faint"
                        )}
                      >
                        {option.dots} {option.level}
                      </button>
                    );
                  })}
                </span>
                <button
                  type="button"
                  aria-label={`移除技能 ${skill.name}`}
                  onClick={() => remove(skill.name)}
                  className="rounded-control px-1.5 py-0.5 text-ink-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {value.length >= MAX_SKILLS ? (
        <p className="text-caption text-ink-faint">技能最多 {MAX_SKILLS} 项</p>
      ) : null}
    </div>
  );
}
