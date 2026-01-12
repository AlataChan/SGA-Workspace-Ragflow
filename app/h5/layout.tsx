import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "H5 Chat",
  description: "Mobile chat entry for Workspace",
}

export default function H5Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-[100dvh] bg-background text-foreground">{children}</div>
}
