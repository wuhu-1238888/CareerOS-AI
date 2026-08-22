/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse(4.2 简历文本提取)仅在 Node runtime 路由中引用,不做 RSC 打包
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  outputFileTracingIncludes: {
    // 7.10 部署适配:Agent 在 tRPC 路由内以 fs 读 prompt(src/lib/agents/base.ts loadPrompt),
    // 静态追踪分析不到运行时 readFileSync 依赖 → 显式打进 Vercel Serverless 产物(构建后 .nft.json 验证)
    "/api/trpc/[trpc]": ["./src/lib/prompts/**/*.md"],
  },
};

export default nextConfig;
