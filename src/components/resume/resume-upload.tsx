"use client";
// 简历上传组件(4.1):拖拽/点选上传(PDF/.docx ≤10MB,40px 主按钮)+ 12px 格式与隐私说明。
// 上传走 /api/resume/upload(Route Handler 自鉴权),失败 Banner 说明原因可重试;
// 提取失败(如图片型 PDF)→ Banner 引导粘贴补全(pasteText);无简历时也可直接粘贴(createFromText)。
// 无画像用户提示「完成职业画像可获得更好的优化效果」(PRD 路径 C)。
// 4.12 重构:拖拽区常显 —— 已有简历时标题为「上传新简历」并声明「新增一份独立简历,不会修改或删除已有简历」;
// 移除旧文件状态卡与「更换简历」按钮(每次上传都 CREATE 新行,不存在 Replace);resumeId 让自身 get 与 hub 同源同一行。
import { useRef, useState } from "react";
import { Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const PASTE_MIN = 10;
const PASTE_MAX = 20000;

// 提取失败码 → 友好文案(行已创建,原文待粘贴补全)
const EXTRACT_ERROR_TEXT: Record<string, string> = {
  "no-text": "未从文件中提取到文本(可能是图片型 PDF),请粘贴简历文本继续",
  invalid: "文件解析失败,请粘贴简历文本或重新上传",
  unsupported: "文件格式暂不支持解析,请粘贴简历文本或重新上传",
};

export function ResumeUpload({
  resumeId,
  onUploaded,
}: {
  /** 当前活跃简历行 id(4.12):与 hub 的 get 同输入共享缓存;未传 = 取最新行 */
  resumeId?: string;
  /** 上传成功回调(4.12):hub 用于清 URL 参数,让 get 回落最新行并自动切到新简历 */
  onUploaded?: () => void;
}) {
  const utils = trpc.useUtils();
  const resume = trpc.resume.get.useQuery({ resumeId });
  const profile = trpc.profile.get.useQuery();
  const createFromText = trpc.resume.createFromText.useMutation();
  const pasteText = trpc.resume.pasteText.useMutation();

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploadError(null);
    // 客户端预校验(服务端同样校验):扩展名 + 大小
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext === ".doc") {
      setUploadError("暂不支持旧版 .doc 格式,请在 Word 中另存为 .docx 或导出为 PDF 后上传");
      return;
    }
    if (ext !== ".pdf" && ext !== ".docx") {
      setUploadError("仅支持 PDF 或 Word(.docx)格式的简历");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("文件超过 10MB 上限,请压缩后再上传");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        const message =
          body && typeof body.error === "string" ? body.error : "上传失败,请稍后重试";
        setUploadError(message);
        return;
      }
      // 4.12:先通知 hub 清 URL 参数(resume.get 回落最新行 = 刚建的新行),再刷新
      onUploaded?.();
      await utils.resume.get.invalidate();
    } catch {
      setUploadError("上传失败,请检查网络后重试");
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste() {
    const text = pasteValue.trim();
    if (text.length < PASTE_MIN) {
      setPasteError(`简历内容至少 ${PASTE_MIN} 个字符`);
      return;
    }
    if (text.length > PASTE_MAX) {
      setPasteError(`简历内容最多 ${PASTE_MAX} 字`);
      return;
    }
    setPasteError(null);
    try {
      if (resume.data?.extractError) {
        await pasteText.mutateAsync({ resumeId: resume.data.id, text });
      } else {
        await createFromText.mutateAsync({ text });
      }
      setPasteValue("");
      setPasteOpen(false);
      await utils.resume.get.invalidate();
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "保存失败,请稍后重试");
    }
  }

  const latest = resume.data;
  // 已有简历(任意行,含提取失败行):拖拽区切换为「上传新简历」文案;无简历 = 首次上传
  const hasExisting = !!latest;
  const hasValidResume = !!latest && !latest.extractError;
  const extractBanner =
    latest?.extractError ? EXTRACT_ERROR_TEXT[latest.extractError] ?? "文件解析失败,请粘贴简历文本继续" : null;

  return (
    <div className="w-full space-y-4 py-6">
      {/* 唯一的隐藏文件输入:拖拽区共用(4.12 起不再有「更换简历」按钮) */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = "";
        }}
      />

      {profile.isSuccess && !profile.data && (
        <div className="flex items-start gap-2 rounded-control bg-info-bg px-3 py-2.5 text-body-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>完成职业画像可获得更好的优化效果,可先前往「职业画像」填写。</span>
        </div>
      )}

      {/* 拖拽区常显(4.12):无简历 = 首次上传;有简历 = 上传新简历(新增独立简历,绝不覆盖旧行) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={hasExisting ? "上传新简历" : "上传简历"}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-card border border-dashed bg-sunken px-6 py-12 text-center transition-colors",
          dragging ? "border-green-600 bg-green-50" : "border-hairline-strong hover:border-green-400"
        )}
      >
        <Upload className="size-8 text-ink-faint" aria-hidden />
        <div className="space-y-1">
          {hasExisting ? (
            <>
              <p className="text-body-sm font-medium text-ink-secondary">上传新简历</p>
              <p className="text-caption text-ink-muted">
                上传 PDF 或 DOCX 格式的新简历,不超过 10MB;本次上传会新增一份独立简历,不会修改或删除已有简历
              </p>
            </>
          ) : (
            <>
              <p className="text-body-sm font-medium text-ink-secondary">
                拖拽简历文件到这里,或点击选择文件
              </p>
              <p className="text-caption text-ink-muted">
                支持 PDF / Word(.docx)格式,不超过 10MB;文件将加密存储,仅用于本模块优化
              </p>
            </>
          )}
        </div>
        <Button type="button" size="lg" disabled={uploading} onClick={(e) => e.stopPropagation()}>
          {uploading ? "上传中…" : hasExisting ? "选择文件" : "上传简历"}
        </Button>
      </div>

      {uploadError && (
        <div className="flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-body-sm text-danger">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{uploadError}</span>
        </div>
      )}

      {extractBanner && latest && (
        <div className="space-y-3 rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div className="flex items-start gap-2 rounded-control bg-warning-bg px-3 py-2.5 text-body-sm text-warning">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{extractBanner}</span>
          </div>
          {!pasteOpen && (
            <Button type="button" variant="secondary" onClick={() => setPasteOpen(true)}>
              粘贴简历文本
            </Button>
          )}
        </div>
      )}

      {!hasValidResume && !pasteOpen && (
        <p className="text-center text-caption text-ink-muted">
          没有文件?也可以
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="ml-1 text-green-700 underline underline-offset-2"
          >
            直接粘贴简历文本
          </button>
        </p>
      )}

      {pasteOpen && (
        <div className="space-y-3 rounded-card border border-hairline bg-surface p-4 shadow-card">
          <Textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="把简历全文粘贴到这里(至少 10 个字符)"
            rows={10}
            maxLength={PASTE_MAX + 1}
            aria-label="简历文本"
          />
          {pasteError && <p className="text-body-sm text-danger">{pasteError}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPasteOpen(false);
                setPasteError(null);
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={pasteText.isPending || createFromText.isPending}
              onClick={() => void handlePaste()}
            >
              {pasteText.isPending || createFromText.isPending ? "保存中…" : "保存简历文本"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
