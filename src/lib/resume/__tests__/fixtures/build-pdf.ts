// 手工构造最小 PDF fixture(单页、标准 Helvetica、每行一个绝对定位文本对象):
// lines 按「内容流写入顺序」输出,调用方可故意逆序/乱序以模拟 z-order 写入的 PDF(4.10 修复目标场景);
// 文本仅限 ASCII(标准 Helvetica 无 CJK 编码,CJK 拼接行为由 pdf-position-sort 纯函数单测覆盖)。
export type PdfLine = { x: number; y: number; text: string };

export function buildSimplePdf(lines: PdfLine[]): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT\n/F1 12 Tf\n${lines
    .map((l) => `1 0 0 1 ${l.x} ${l.y} Tm (${escape(l.text)}) Tj`)
    .join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
