/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 生产环境配置
  // 使用SWC（Next.js默认）
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // 跳过静态生成，避免构建时环境变量问题
  trailingSlash: false,
  generateBuildId: () => 'build-' + Date.now(),
}

export default nextConfig
