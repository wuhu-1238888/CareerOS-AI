// 简历上传组件测试(4.1):无画像提示/上传成功刷新/上传失败 Banner/提取失败引导粘贴/直接粘贴创建
// 4.12:拖拽区常显(有已有简历 = 「上传新简历」,无「更换简历」按钮/旧文件卡);onUploaded 先于 invalidate;resumeId 透传 get
// 4.13:「从已有简历继续」列表(resume.list)→ 点击「继续优化」调 onSelectResume
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const fetchMock = vi.hoisted(() => ({
  calls: [] as { url: string; init?: RequestInit }[],
  respond: async () =>
    new Response(
      JSON.stringify({ ok: true, resumeId: "r-new", textLength: 100, extractError: null }),
      { status: 200 }
    ),
}));
vi.stubGlobal(
  "fetch",
  async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchMock.calls.push({ url: String(url), init });
    return fetchMock.respond();
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

describe("ResumeUpload", () => {
  it("无简历 + 无画像:提示完成画像 + 拖拽区与「上传简历」按钮", async () => {
    const { container } = render(<ResumeUpload />);
    expect(await screen.findByText(/完成职业画像可获得更好的优化效果/)).toBeInTheDocument();
    // 拖拽区(role=button)与真实按钮同名为「上传简历」
    const matches = screen.getAllByRole("button", { name: "上传简历" });
    expect(matches.some((el) => el.tagName === "BUTTON")).toBe(true);
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText(/支持 PDF \/ Word\(\.docx\)格式,不超过 10MB/)).toBeInTheDocument();
  });

  it("选择合法 PDF:走 /api/resume/upload 并刷新简历;成功后显示文件状态卡", async () => {
    mocks.resumeData = null;
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(fetchMock.calls.length).toBe(1));
    expect(fetchMock.calls[0]!.url).toBe("/api/resume/upload");
    expect(fetchMock.calls[0]!.init?.method).toBe("POST");
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
  });

  it("不支持的格式:客户端拦截,不发请求,显示 Banner", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["text"], "简历.txt", { type: "text/plain" }));
    expect(await screen.findByText("仅支持 PDF 或 Word(.docx)格式的简历")).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
  });

  it("旧版 .doc:提示另存为 .docx 或 PDF", async () => {
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["binary"], "旧简历.doc", { type: "application/msword" }));
    expect(
      await screen.findByText("暂不支持旧版 .doc 格式,请在 Word 中另存为 .docx 或导出为 PDF 后上传")
    ).toBeInTheDocument();
    expect(fetchMock.calls.length).toBe(0);
  });

  it("上传失败(服务端 413):显示服务端错误 Banner", async () => {
    fetchMock.respond = async () =>
      new Response(JSON.stringify({ error: "文件超过 10MB 上限,请压缩后再上传", code: "too-large" }), {
        status: 413,
      });
    const { container } = render(<ResumeUpload />);
    pickFile(container, new File(["big"], "大文件.pdf", { type: "application/pdf" }));
    expect(
      await screen.findByText("文件超过 10MB 上限,请压缩后再上传")
    ).toBeInTheDocument();
    expect(mocks.invalidate).not.toHaveBeenCalled();
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

  it("上传成功(4.12):先调 onUploaded 再刷新", async () => {
    const onUploaded = vi.fn();
    const { container } = render(<ResumeUpload onUploaded={onUploaded} />);
    pickFile(container, new File(["pdf-content"], "张伟简历.pdf", { type: "application/pdf" }));
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

  it("拖拽文件到拖拽区:同样触发上传", async () => {
    render(<ResumeUpload />);
    const zone = screen.getByLabelText("上传简历");
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["pdf"], "拖入.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(fetchMock.calls.length).toBe(1));
    expect(fetchMock.calls[0]!.url).toBe("/api/resume/upload");
  });
});
