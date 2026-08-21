/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse(4.2 简历文本提取)仅在 Node runtime 路由中引用,不做 RSC 打包
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
