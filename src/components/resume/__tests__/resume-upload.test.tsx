// 简历上传组件测试(4.1):无画像提示/上传成功刷新/上传失败 Banner/提取失败引导粘贴/直接粘贴创建
// 4.12:拖拽区常显(有已有简历 = 「上传新简历」,无「更换简历」按钮/旧文件卡);onUploaded 先于 invalidate;resumeId 透传 get
// 4.13:「从已有简历继续」列表(resume.list)→ 点击「继续优化」调 onSelectResume
// 4.14:三态流程(选文件只入待确认态 → 开始分析才上传;解析中可取消上传)+ ← 返回/面包屑/取消(onExit)
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeUpload } from "../resume-upload";

type ResumeMeta = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  extractError: string | null;
  createdAt: string;
  updatedAt: string;
};

const mocks = vi.hoisted(() => ({
  resumeData: null as ResumeMeta | null,
  resumeLoading: false,
  listData: [] as ResumeMeta[] | null,
  profileData: null as unknown,
  profileLoading: false,
  profileSuccess: true,
  createMutateAsync: vi.fn(),
  pasteMutateAsync: vi.fn(),
  createPending: false,
  pastePending: false,
  invalidate: vi.fn(),
  getInput: null as { resumeId?: string } | null,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidate } } }),
    resume: {
      get: {
        useQuery: (input?: { resumeId?: string }) => {
          mocks.getInput = input ?? null;
          return { data: mocks.resumeData, isLoading: mocks.resumeLoading };
        },
      },
      list: {
        useQuery: () => ({ data: mocks.listData, isLoading: false, isSuccess: true }),
      },
      createFromText: {
        useMutation: () => ({
          mutateAsync: mocks.createMutateAsync,
          isPending: mocks.createPending,
        }),
      },
      pasteText: {
        useMutation: () => ({
          mutateAsync: mocks.pasteMutateAsync,
          isPending: mocks.pastePending,
        }),
      },
    },
    profile: {
      get: {
        useQuery: () => ({
          data: mocks.profileData,
          isLoading: mocks.profileLoading,
          isSuccess: mocks.profileSuccess,
        }),
      },
    },
  },
}));

// 4.14:respond 接收 init,测试可用 signal 模拟「abort 时以 AbortError 拒绝 / 挂起在途请求」
const fetchMock = vi.hoisted(() => ({
  calls: [] as { url: string; init?: RequestInit }[],
  respond: (async () =>
    new Response(
      JSON.stringify({ ok: true, resumeId: "r-new", textLength: 100, extractError: null }),
      { status: 200 }
    )) as (init?: RequestInit) => Promise<Response>,
}));
vi.stubGlobal(
  "fetch",
  async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchMock.calls.push({ url: String(url), init });
    return fetchMock.respond(init);
  }
);

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.calls = [];
  mocks.resumeData = null;
  mocks.resumeLoading = false;
  mocks.listData = [];
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.profileSuccess = true;
  mocks.createPending = false;
  mocks.pastePending = false;
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.createMutateAsync.mockResolvedValue({ id: "r1" });
  mocks.pasteMutateAsync.mockResolvedValue({ id: "r1" });
  fetchMock.respond = async () =>
    new Response(
      JSON.stringify({ ok: true, resumeId: "r-new", textLength: 100, extractError: null }),
      { status: 200 }
    );
});

function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

// 模拟在途请求:不响应,abort 时以 AbortError 拒绝(等价 fetch 被中止)
function pendingUploadRespond(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
}

describe("ResumeUpload", () => {
  it("无简历 + 无画像:提示完成画像 + 拖拽区与动作行「选择文件」(4.14)", async () => {
    const { container } = render(<ResumeUpload />);
    expect(await screen.findByText(/完成职业画像可获得更好的优化效果/)).toBeInTheDocument();
    // 拖拽区(role=button)label「上传简历」+ 动作行真实按钮「选择文件」(4.14 起拖拽区内不再嵌套真实按钮)
    expect(screen.getByRole("button", { name: "上传简历" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择文件" }).tagName).toBe("BUTTON");
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText(/支持 PDF \/ Word\(\.docx\)格式,不超过 10MB/)).toBeInTheDocument();
    // 未传 onExit:不渲染 返回/取消/面包屑(4.14)
    expect(screen.queryByRole("button", { name: "返回" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("选择合法 PDF(4.14):进入「已选文件」待确认态(文件名+大小),拖拽区隐藏,不发请求", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(
      container,
      new File([new Uint8Array(2048)], "张伟简历.pdf", { type: "application/pdf" })
    );
    expect(await screen.findByText("张伟简历.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
    expect(screen.queryByLabelText("上传简历")).not.toBeInTheDocument(); // 拖拽区隐藏
    expect(screen.getByRole("button", { name: "重新选择" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始分析" })).toBeInTheDocument();
  });

  it("已选文件点「开始分析」(4.14):才走 /api/resume/upload 并刷新;成功后清空文件卡", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    await waitFor(() => expect(fetchMock.calls.length).toBe(1));
    expect(fetchMock.calls[0]!.url).toBe("/api/resume/upload");
    expect(fetchMock.calls[0]!.init?.method).toBe("POST");
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    // 成功即清已选文件:文件卡消失,拖拽区恢复
    await waitFor(() => expect(screen.queryByText("张伟简历.pdf")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "上传简历" })).toBeInTheDocument();
  });

  it("已选文件(4.14):点「重新选择」清空回拖拽区", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(await screen.findByRole("button", { name: "重新选择" }));
    expect(screen.queryByText("张伟简历.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传简历" })).toBeInTheDocument();
  });

  it("不支持的格式:客户端拦截,不发请求,显示 Banner", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["text"], "简历.txt", { type: "text/plain" }));
    expect(await screen.findByText("仅支持 PDF 或 Word(.docx)格式的简历")).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
    expect(screen.queryByText("简历.txt")).not.toBeInTheDocument(); // 不进已选文件态
  });

  it("旧版 .doc:提示另存为 .docx 或 PDF", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["binary"], "旧简历.doc", { type: "application/msword" }));
    expect(
      await screen.findByText("暂不支持旧版 .doc 格式,请在 Word 中另存为 .docx 或导出为 PDF 后上传")
    ).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
  });

  it("上传失败(服务端 413):点「开始分析」后显示服务端错误 Banner,文件卡保留", async () => {
    fetchMock.respond = async () =>
      new Response(JSON.stringify({ error: "文件超过 10MB 上限,请压缩后再上传", code: "too-large" }), {
        status: 413,
      });
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["big"], "大文件.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    expect(
      await screen.findByText("文件超过 10MB 上限,请压缩后再上传")
    ).toBeInTheDocument();
    expect(mocks.invalidate).not.toHaveBeenCalled();
    // 失败保留已选文件(可重新选择/重试)
    expect(screen.getByText("大文件.pdf")).toBeInTheDocument();
  });

  it("提取失败(no-text):警告 Banner + 粘贴补全走 pasteText,载荷带 resumeId", async () => {
    mocks.resumeData = {
      id: "r-broken",
      fileName: "扫描件.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: "no-text",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    render(<ResumeUpload />);
    expect(
      await screen.findByText("未从文件中提取到文本(可能是图片型 PDF),请粘贴简历文本继续")
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "粘贴简历文本" }));
    await userEvent
      .setup()
      .type(screen.getByLabelText("简历文本"), "张伟\n求职意向:后端开发工程师\n教育经历:某大学本科");
    await userEvent.setup().click(screen.getByRole("button", { name: "保存简历文本" }));
    await waitFor(() =>
      expect(mocks.pasteMutateAsync).toHaveBeenCalledWith({
        resumeId: "r-broken",
        text: "张伟\n求职意向:后端开发工程师\n教育经历:某大学本科",
      })
    );
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
  });

  it("无简历直接粘贴:走 createFromText;内容过短提示", async () => {
    render(<ResumeUpload />);
    await userEvent.setup().click(screen.getByRole("button", { name: "直接粘贴简历文本" }));
    const textarea = screen.getByLabelText("简历文本");
    await userEvent.setup().type(textarea, "太短");
    await userEvent.setup().click(screen.getByRole("button", { name: "保存简历文本" }));
    expect(await screen.findByText("简历内容至少 10 个字符")).toBeInTheDocument();
    expect(mocks.createMutateAsync).not.toHaveBeenCalled();

    await userEvent.setup().clear(textarea);
    await userEvent
      .setup()
      .type(textarea, "张伟\n求职意向:后端开发工程师\n教育经历:某大学本科");
    await userEvent.setup().click(screen.getByRole("button", { name: "保存简历文本" }));
    await waitFor(() =>
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        text: "张伟\n求职意向:后端开发工程师\n教育经历:某大学本科",
      })
    );
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
  });

  it("已有简历(4.12):显示「上传新简历」拖拽区与新增说明,无「更换简历」按钮与旧文件卡", async () => {
    mocks.resumeData = {
      id: "r-ok",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 204800,
      extractError: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    render(<ResumeUpload />);
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    expect(screen.getByText(/本次上传会新增一份独立简历,不会修改或删除已有简历/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeInTheDocument();
    // 不再显示旧文件卡与「更换简历」
    expect(screen.queryByText("张伟简历.pdf")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更换简历" })).not.toBeInTheDocument();
  });

  it("从已有简历继续(4.13):列出可切换的行,点击「继续优化」调 onSelectResume;提取失败行标注待补全", async () => {
    mocks.listData = [
      { id: "r-a", fileName: "产品经理简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "r-b", fileName: null, mimeType: null, sizeBytes: null, extractError: "no-text", createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" },
    ];
    const onSelectResume = vi.fn();
    render(<ResumeUpload onSelectResume={onSelectResume} />);
    expect(await screen.findByText("从已有简历继续")).toBeInTheDocument();
    expect(screen.getByText("产品经理简历.pdf")).toBeInTheDocument();
    expect(screen.getByText(/待补全:粘贴简历文本/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "继续优化" });
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[0]!);
    expect(onSelectResume).toHaveBeenCalledWith("r-a");
  });

  it("从已有简历继续(4.13):无已有简历时不渲染该区块", () => {
    render(<ResumeUpload />);
    expect(screen.queryByText("从已有简历继续")).not.toBeInTheDocument();
  });

  it("上传成功(4.12/4.14):先调 onUploaded 再刷新", async () => {
    const onUploaded = vi.fn();
    const { container } = render(<ResumeUpload onUploaded={onUploaded} />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    // 顺序:onUploaded 先于 invalidate(hub 先清 URL 参数,刷新才回落最新行)
    expect(onUploaded.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.invalidate.mock.invocationCallOrder[0]!
    );
  });

  it("resumeId(4.12):透传给 resume.get 输入", () => {
    render(<ResumeUpload resumeId="r-active" />);
    expect(mocks.getInput).toEqual({ resumeId: "r-active" });
  });

  it("拖拽文件到拖拽区(4.14):进入已选文件态,不发请求", async () => {
    render(<ResumeUpload />);
    const zone = screen.getByLabelText("上传简历");
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["pdf"], "拖入.pdf", { type: "application/pdf" })] },
    });
    expect(await screen.findByText("拖入.pdf")).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
  });

  it("未选文件(4.14):点「取消」调 onExit", async () => {
    const onExit = vi.fn();
    render(<ResumeUpload onExit={onExit} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "取消" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("已选文件(4.14):点「取消」调 onExit", async () => {
    const onExit = vi.fn();
    const { container } = render(<ResumeUpload onExit={onExit} />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(await screen.findByRole("button", { name: "取消" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("解析中(4.14):显示状态卡与「取消上传」;点取消 → 静默回已选文件态,无错误 Banner,不刷新", async () => {
    fetchMock.respond = pendingUploadRespond;
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    expect(await screen.findByText("正在解析简历…")).toBeInTheDocument();
    expect(screen.getByText("取消不会影响已有简历")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "取消上传" }));
    // 回到已选文件态(文件保留,可重试),无错误 Banner,不触发刷新
    expect(await screen.findByText("张伟简历.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始分析" })).toBeInTheDocument();
    expect(screen.queryByText("上传失败,请检查网络后重试")).not.toBeInTheDocument();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("解析中卸载(4.14):cleanup abort 在途请求,不抛未处理 rejection", async () => {
    fetchMock.respond = pendingUploadRespond;
    const { container, unmount } = render(<ResumeUpload />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    await screen.findByText("正在解析简历…");
    unmount();
    // 组件已卸载;catch 静默处理后无未处理 rejection(vitest 会直接失败若存在)
    await waitFor(() => expect(fetchMock.calls.length).toBe(1));
  });

  it("请求已成功后才点「取消上传」(4.14):abort 无效,onUploaded 照常", async () => {
    // 模拟服务端已完成:响应不受 abort 影响(等价于 abort 晚于响应,规范 no-op)
    let resolveUpload!: (response: Response) => void;
    fetchMock.respond = () => new Promise<Response>((resolve) => (resolveUpload = resolve));
    const onUploaded = vi.fn();
    const { container } = render(<ResumeUpload onUploaded={onUploaded} />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "开始分析" }));
    await screen.findByText("正在解析简历…");
    await userEvent.setup().click(screen.getByRole("button", { name: "取消上传" }));
    resolveUpload(
      new Response(
        JSON.stringify({ ok: true, resumeId: "r-new", textLength: 100, extractError: null }),
        { status: 200 }
      )
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    expect(screen.queryByText("上传失败,请检查网络后重试")).not.toBeInTheDocument();
  });

  it("面包屑(4.14):crumbParent=简历优化 → 「简历优化 > 上传新简历」,父级与「返回」都调 onExit", async () => {
    const onExit = vi.fn();
    render(<ResumeUpload onExit={onExit} crumbParent="简历优化" />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByText("简历优化")).toBeInTheDocument();
    expect(within(nav).getByText("上传新简历")).toBeInTheDocument();
    await userEvent.setup().click(within(nav).getByRole("button", { name: "简历优化" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it("面包屑(4.14):crumbParent=简历中心 → 「简历中心 > 上传新简历」", () => {
    render(<ResumeUpload onExit={vi.fn()} crumbParent="简历中心" />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByText("简历中心")).toBeInTheDocument();
    expect(within(nav).getByText("上传新简历")).toBeInTheDocument();
  });
});
