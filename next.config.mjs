/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产环境由 .env.production 注入 NEXT_PUBLIC_ASSET_PREFIX(正式域名):
  // 静态资源(chunk/RSC)URL 固化为正式域名,PocketBay 发布专属域名(--e)不再影响资源加载
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX,
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
