import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 每个测试后清理
afterEach(() => {
  // node 环境下没有 DOM，跳过 cleanup
  if (typeof document !== 'undefined') cleanup()
})

// JSDOM does not implement scrollIntoView; mock it for components that call it.
if (typeof window !== 'undefined' && window.HTMLElement) {
  if (!('scrollIntoView' in window.HTMLElement.prototype)) {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      value: () => {},
      writable: true,
    })
  }
}

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '',
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))
