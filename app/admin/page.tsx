"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
// import AdminLayout from "@/components/admin/admin-layout"

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    // 重定向到公司设置页面
    router.push('/admin/company')
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-white">正在跳转到管理后台...</div>
    </div>
  )
}
