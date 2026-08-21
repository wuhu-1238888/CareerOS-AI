// pdf-parse 子路径模块声明(4.2):直接引入 lib/pdf-parse.js 规避 index.js 的 debug 模式
// (debug 模式在模块加载时读取示例 PDF 文件,打包/服务端运行会失败)
// 4.10 修复:pagerender 补类型(自定义页渲染按视觉坐标排序,见 resume/parser.ts)
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }
  interface PdfTextContentItem {
    str: string;
    transform: number[];
  }
  interface PdfPageData {
    getTextContent(options: {
      normalizeWhitespace: boolean;
      disableCombineTextItems: boolean;
    }): Promise<{ items: PdfTextContentItem[] }>;
  }
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (pageData: PdfPageData) => Promise<string>; max?: number; version?: string }
  ): Promise<PdfParseResult>;
  export = pdfParse;
}
