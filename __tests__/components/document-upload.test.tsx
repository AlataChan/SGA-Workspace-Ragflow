import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentUpload } from '@/components/knowledge-base/document-upload'

/**
 * 文档上传组件测试
 */

// Mock fetch
global.fetch = vi.fn()

describe('DocumentUpload', () => {
  const mockProps = {
    kbId: 'test-kb-1',
    autoRun: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染上传区域', () => {
    render(<DocumentUpload {...mockProps} />)
    expect(screen.getByText(/拖拽文件到这里/)).toBeInTheDocument()
    expect(screen.getByText(/选择文件/)).toBeInTheDocument()
  })

  it('应该显示支持的文件类型', () => {
    render(<DocumentUpload {...mockProps} />)
    expect(screen.getByText(/支持 PDF, DOCX, DOC, TXT, MD 格式/)).toBeInTheDocument()
  })

  it('应该显示文件大小限制', () => {
    render(<DocumentUpload {...mockProps} />)
    expect(screen.getByText(/最大 100MB/)).toBeInTheDocument()
  })

  it('应该处理文件选择', async () => {
    const onUploadSuccess = vi.fn()
    render(<DocumentUpload {...mockProps} onUploadSuccess={onUploadSuccess} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    // Mock successful upload
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'doc-1' },
      }),
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/knowledge-bases/${mockProps.kbId}/documents`,
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  it('应该拒绝不支持的文件类型', async () => {
    render(<DocumentUpload {...mockProps} />)

    const file = new File(['test content'], 'test.exe', { type: 'application/x-msdownload' })
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      // 应该显示错误提示（通过toast）
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('应该拒绝超过大小限制的文件', async () => {
    render(<DocumentUpload {...mockProps} />)

    // 创建一个超过100MB的文件
    const largeFile = new File(
      [new ArrayBuffer(101 * 1024 * 1024)],
      'large.pdf',
      { type: 'application/pdf' }
    )
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    fireEvent.change(input, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  it('应该支持拖拽上传', async () => {
    render(<DocumentUpload {...mockProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const dropZone = screen.getByText(/拖拽文件到这里/).closest('div')

    // Mock successful upload
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'doc-1' },
      }),
    })

    if (dropZone) {
      fireEvent.dragOver(dropZone)
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      })
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('应该在拖拽时改变样式', () => {
    const { container } = render(<DocumentUpload {...mockProps} />)
    const dropZone = screen.getByText(/拖拽文件到这里/).closest('div')

    if (dropZone) {
      fireEvent.dragOver(dropZone)
      expect(dropZone.className).toContain('border-primary')
    }
  })

  it('应该显示上传进度', async () => {
    render(<DocumentUpload {...mockProps} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    // Mock upload in progress
    ;(global.fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                data: { id: 'doc-1' },
              }),
            })
          }, 100)
        })
    )

    fireEvent.change(input, { target: { files: [file] } })

    // 应该显示文件名
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })

  it('应该调用onUploadSuccess回调', async () => {
    const onUploadSuccess = vi.fn()
    render(<DocumentUpload {...mockProps} onUploadSuccess={onUploadSuccess} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'doc-1' },
      }),
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledWith('doc-1')
    })
  })

  it('应该调用onUploadError回调', async () => {
    const onUploadError = vi.fn()
    render(<DocumentUpload {...mockProps} onUploadError={onUploadError} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/选择文件/) as HTMLInputElement

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Upload failed',
      }),
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onUploadError).toHaveBeenCalled()
    })
  })
})

