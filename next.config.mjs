/** @type {import('next').NextConfig} */
const nextConfig = {
  // 注意:不要配置 assetPrefix —— PocketBay 会通过发布专属域名(--e)承载部分请求,
  // 跨域 assetPrefix 会让 RSC 数据请求被 CORS 拦截(Next 14.2 不带 ACAO 头),
  // 客户端路由跳转将全部失效。静态资源保持相对路径,随页面源加载即可。
  experimental: {
    // pdf-parse(4.2 简历文本提取)仅在 Node runtime 路由中引用,不做 RSC 打包
    serverComponentsExternalPackages: ["pdf-parse"],
    // 5.3 部署适配:Agent 在 tRPC 路由内以 fs 读 prompt(src/lib/agents/base.ts loadPrompt),
    // 静态追踪分析不到运行时 readFileSync 依赖 → 显式打进 Vercel Serverless 产物(构建后 .nft.json 验证)。
    // 2026-08-23 修正:此前误放顶层(Next.js 14.2 不识别、静默忽略并告警 "Unrecognized key(s)"),
    // 正确层级在 experimental 下。
    outputFileTracingIncludes: {
      "/api/trpc/[trpc]": ["./src/lib/prompts/**/*.md"],
    },
  },
};

export default nextConfig;
