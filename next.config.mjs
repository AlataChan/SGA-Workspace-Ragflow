/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
  // 禁用SWC以避免二进制文件损坏问题
  swcMinify: false,
  poweredByHeader: false,
  reactStrictMode: true,

  // 实验性功能 - 使用Babel替代SWC
  experimental: {
    forceSwcTransforms: false,
  },
}

export default nextConfig
