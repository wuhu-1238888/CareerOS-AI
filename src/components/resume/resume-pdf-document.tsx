"use client";
// 简历 PDF 文档(4.7,@react-pdf/renderer):仅经 resume-export 的 useEffect 动态 import 加载
// (react-pdf 引用 window/canvas,任何 SSR 路径 import 即崩,禁用 next/dynamic 静态路径)。
// 排版无专门规格,采用克制专业排版:姓名大标题 + 联系信息 + 分节标题 + 内容行;
// 颜色全部取自设计 token(colors 导入,零硬编码);无渐变无装饰。
// 字体 Noto Sans SC(OFL 许可,public/fonts,~8MB×2 为 MVP 取舍):react-pdf 默认字体无 CJK 字形,注册后中文正常渲染。
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { colors } from "@/lib/design/tokens";

// 注册中文字体(家族名不带空格,react-pdf 以 fontFamily 为内部键);src 为 public 路径,渲染时按需拉取
Font.register({
  family: "NotoSansSC",
  fonts: [
    { src: "/fonts/NotoSansSC-Regular.otf", fontWeight: "normal" },
    { src: "/fonts/NotoSansSC-Bold.otf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "NotoSansSC",
    fontSize: 10,
    color: colors.ink.DEFAULT,
  },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  contact: { fontSize: 9.5, color: colors.ink.muted, marginBottom: 2 },
  section: { marginTop: 14 },
  heading: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: colors.ink.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline.DEFAULT,
    paddingBottom: 4,
    marginBottom: 6,
  },
  line: { fontSize: 10, lineHeight: 1.6, color: colors.ink.secondary },
});

type Block = { heading: string; lines: string[] };

// 轻量分段:首行为姓名,随后至首个空行的连续行为联系信息;其余按空行分块,块首行为分节标题
function parseBlocks(text: string): { name: string; contact: string[]; blocks: Block[] } {
  const lines = text.split("\n");
  const name = lines[0]?.trim() ?? "";
  const contact: string[] = [];
  let index = 1;
  while (index < lines.length && lines[index]!.trim().length > 0) {
    contact.push(lines[index]!.trim());
    index++;
  }
  const blocks: Block[] = [];
  let current: string[] = [];
  for (let i = index; i <= lines.length; i++) {
    const line = i < lines.length ? lines[i]! : "";
    if (line.trim().length === 0) {
      if (current.length > 0) {
        blocks.push({ heading: current[0]!, lines: current.slice(1) });
        current = [];
      }
      continue;
    }
    current.push(line.trim());
  }
  return { name, contact, blocks };
}

export function ResumePdfDocument({ text }: { text: string }) {
  const { name, contact, blocks } = parseBlocks(text);
  return (
    <Document title="简历" author={name || undefined} creator="CareerOS AI">
      <Page size="A4" style={styles.page}>
        {name && <Text style={styles.name}>{name}</Text>}
        {contact.map((line) => (
          <Text key={line} style={styles.contact}>
            {line}
          </Text>
        ))}
        {blocks.map((block, index) => (
          <View key={`${block.heading}-${index}`} style={styles.section} wrap={false}>
            <Text style={styles.heading}>{block.heading}</Text>
            {block.lines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
