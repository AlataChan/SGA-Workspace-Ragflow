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

  webpack: (config, { isServer }) => {
    // ldapjs 的 dtrace-provider 属于可选/原生依赖；在 Windows/构建场景会导致解析失败
    // 这里显式禁用该模块的解析，避免 Next.js 构建报错
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias["dtrace-provider"] = false

    // 某些情况下（server bundle）依然可能尝试打包，可显式 externalize
    if (isServer) {
      config.externals = config.externals || []
    }

    return config
  },
}

export default nextConfig
