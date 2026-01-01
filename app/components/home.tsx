/**
 * NextChat 遗留组件存根
 * 提供基本的类型兼容性，避免编译错误
 */
'use client'

import React from 'react'

// Loading 组件
export function Loading({ noLogo }: { noLogo?: boolean }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

// 主页组件（存根）
export function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loading />
    </div>
  )
}

export default Home
