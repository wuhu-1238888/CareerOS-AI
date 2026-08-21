// pdf-parse 子路径模块声明(4.2):直接引入 lib/pdf-parse.js 规避 index.js 的 debug 模式
// (debug 模式在模块加载时读取示例 PDF 文件,打包/服务端运行会失败)
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: unknown; max?: number; version?: string }
  ): Promise<PdfParseResult>;
  export = pdfParse;
}
