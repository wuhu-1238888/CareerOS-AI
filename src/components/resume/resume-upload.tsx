"use client";
// 简历上传组件(4.1):拖拽/点选上传(PDF/.docx ≤10MB,40px 主按钮)+ 12px 格式与隐私说明。
// 上传走 /api/resume/upload(Route Handler 自鉴权),失败 Banner 说明原因可重试;
// 提取失败(如图片型 PDF)→ Banner 引导粘贴补全(pasteText);无简历时也可直接粘贴(createFromText)。
// 无画像用户提示「完成职业画像可获得更好的优化效果」(PRD 路径 C)。
// 4.12 重构:拖拽区常显 —— 已有简历时标题为「上传新简历」并声明「新增一份独立简历,不会修改或删除已有简历」;
// 移除旧文件状态卡与「更换简历」按钮(每次上传都 CREATE 新行,不存在 Replace);resumeId 让自身 get 与 hub 同源同一行。
// 4.13:「从已有简历继续」列表(resume.list)—— 不传新文件,直接切换活跃简历继续优化(onSelectResume)。
// 4.14:← 返回 + 面包屑(onExit/crumbParent,按来源动态返回);三态流程 —— 选文件只入「已选文件」待确认态,
// 点「开始分析」才发起上传;解析中可「取消上传」(AbortController,取消不影响已有简历)。
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Info, Upload } from "lucide-react";
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

function formatBytes(size: number | null | undefined): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ResumeUpload({
  resumeId,
  onUploaded,
  onSelectResume,
  onExit,
  crumbParent,
}: {
  /** 当前活跃简历行 id(4.12):与 hub 的 get 同输入共享缓存;未传 = 取最新行 */
  resumeId?: string;
  /** 上传成功回调(4.12):hub 用于清 URL 参数,让 get 回落最新行并自动切到新简历 */
  onUploaded?: () => void;
  /** 「从已有简历继续」(4.13):选择已有简历 → hub 切换活跃行并退出上传视图 */
  onSelectResume?: (id: string) => void;
  /** 退出上传视图(4.14):hub 按来源动态决定去向(结果视图 / 「我的简历」Tab);未传时隐藏返回与取消 */
  onExit?: () => void;
  /** 面包屑父级(4.14):与退出目标一致(简历优化 = 回原视图;我的简历 = 跳 /resume?tab=resumes) */
  crumbParent?: "简历优化" | "我的简历";
}) {
  const utils = trpc.useUtils();
  const resume = trpc.resume.get.useQuery({ resumeId });
  const list = trpc.resume.list.useQuery();
  const profile = trpc.profile.get.useQuery();
  const createFromText = trpc.resume.createFromText.useMutation();
  const pasteText = trpc.resume.pasteText.useMutation();

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  // 4.14:已选待确认文件(选文件不再立即上传);abortRef 供解析中「取消上传」中止在途请求
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 卸载时中止在途上传(对已 settle 的请求是 no-op,安全)
  useEffect(() => () => abortRef.current?.abort(), []);

  // 客户端预校验(服务端同样校验):扩展名 + 大小;选择时即校验(4.14),uploadFile 内兜底重校验
  function validateFile(file: File): string | null {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext === ".doc") {
      return "暂不支持旧版 .doc 格式,请在 Word 中另存为 .docx 或导出为 PDF 后上传";
    }
    if (ext !== ".pdf" && ext !== ".docx") {
      return "仅支持 PDF 或 Word(.docx)格式的简历";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "文件超过 10MB 上限,请压缩后再上传";
    }
    return null;
  }

  // 选择/拖入文件(4.14):只进入「已选文件」待确认态,不发请求;非法文件即时提示
  function handleFileSelected(file: File) {
    const err = validateFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
  }

  async function uploadFile(file: File) {
    // 防御性重校验(选择时已校验,此处兜底)
    const err = validateFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError(null);
    setUploading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        const message =
          body && typeof body.error === "string" ? body.error : "上传失败,请稍后重试";
        setUploadError(message);
        return;
      }
      // 4.14:成功即清已选文件 —— 解析中卡不闪回、无二次提交入口;
      // 此后点「取消上传」已无效(abort 对已 resolve 的请求是 no-op,成功路径照常)。
      setSelectedFile(null);
      // 4.12:先通知 hub 清 URL 参数(resume.get 回落最新行 = 刚建的新行),再刷新
      onUploaded?.();
      await utils.resume.get.invalidate();
    } catch {
      // 用户主动「取消上传」:静默回到已选文件态(文件保留,可重试),不显示错误。
      // 竞态说明:abort 时服务端可能已完成建行(孤儿行留在「我的简历」Tab,属可接受限制);
      // 客户端不建任何占位行 —— 行只在完整上传完成后由服务端创建,取消不会产生空简历。
      if (controller.signal.aborted) return;
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
      {/* 4.14:← 返回 + 面包屑定位(父级点击 = 返回,与退出目标一致;未传 onExit 时不渲染) */}
      {onExit && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onExit}>
            <ArrowLeft aria-hidden />
            返回
          </Button>
          <nav aria-label="面包屑" className="flex items-center gap-1.5 text-caption">
            <Button type="button" variant="link" size="sm" className="text-ink-muted" onClick={onExit}>
              {crumbParent ?? "简历优化"}
            </Button>
            <span className="text-ink-faint">&gt;</span>
            <span className="text-ink">上传新简历</span>
          </nav>
        </div>
      )}

      {/* 唯一的隐藏文件输入:拖拽区与「选择文件」共用(4.12 起不再有「更换简历」按钮) */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = "";
        }}
      />

      {profile.isSuccess && !profile.data && (
        <div className="flex items-start gap-2 rounded-control bg-info-bg px-3 py-2.5 text-body-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>完成职业画像可获得更好的优化效果,可先前往「职业画像」填写。</span>
        </div>
      )}

      {/* 上传三态(4.14):解析中 > 已选文件(待确认)> 拖拽区;选文件只入待确认态,「开始分析」才发起上传 */}
      {uploading ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-4 shadow-card"
        >
          <div>
            <p className="text-body-sm font-medium text-ink">正在解析简历…</p>
            <p className="mt-0.5 text-caption text-ink-muted">取消不会影响已有简历</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
            取消上传
          </Button>
        </div>
      ) : selectedFile ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-body-sm font-medium text-ink">{selectedFile.name}</p>
              <p className="text-caption text-ink-muted">{formatBytes(selectedFile.size)}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelectedFile(null)}>
              重新选择
            </Button>
            <Button type="button" onClick={() => void uploadFile(selectedFile)}>
              开始分析
            </Button>
            {onExit && (
              <Button type="button" variant="ghost" onClick={onExit}>
                取消
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
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
              if (file) handleFileSelected(file);
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
          </div>
          {/* 动作行(4.14):「选择文件」触发隐藏 input;「取消」退出上传视图(仅 onExit 提供时) */}
          <div className="flex items-center justify-center gap-2">
            <Button type="button" size="lg" onClick={() => inputRef.current?.click()}>
              选择文件
            </Button>
            {onExit && (
              <Button type="button" variant="ghost" onClick={onExit}>
                取消
              </Button>
            )}
          </div>
        </>
      )}

      {uploadError && (
        <div className="flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-body-sm text-danger">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 「从已有简历继续」(4.13):不传新文件,直接切换活跃简历继续优化;与「上传本地文件」并列的上传视图双路径 */}
      {list.isSuccess && list.data.length > 0 && (
        <section className="rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div>
            <h2 className="text-body-sm font-medium text-ink">从已有简历继续</h2>
            <p className="mt-0.5 text-caption text-ink-muted">选择一份已有简历继续优化,无需重新上传</p>
          </div>
          <ul className="mt-3 divide-y divide-hairline rounded-control border border-hairline">
            {list.data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-ink-muted" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink">
                      {item.fileName ?? "粘贴的简历文本"}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {item.fileName ? `${formatBytes(item.sizeBytes)} · ` : ""}
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                      {item.extractError ? " · 待补全:粘贴简历文本" : ""}
                    </p>
                  </div>
                </div>
                {/* 4.14:解析中禁用 —— 避免切换卸载把在途上传中止 */}
                <Button type="button" size="sm" disabled={uploading} onClick={() => onSelectResume?.(item.id)}>
                  继续优化
                </Button>
              </li>
            ))}
          </ul>
        </section>
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
