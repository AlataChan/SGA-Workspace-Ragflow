import type { Metadata, Viewport } from "next"
import { Suspense, type ReactNode } from "react"
import H5BottomNav from "./components/h5-bottom-nav"

export const metadata: Metadata = {
  title: "H5 Chat",
  description: "Mobile chat entry for Workspace",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function H5Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground overflow-x-hidden">
      <div className="flex-1 min-h-0">{children}</div>
      <Suspense fallback={null}>
        <H5BottomNav />
      </Suspense>
    </div>
  )
}
