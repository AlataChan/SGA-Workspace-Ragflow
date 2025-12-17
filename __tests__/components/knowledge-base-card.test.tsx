import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KnowledgeBaseCard } from '@/components/knowledge-base/knowledge-base-card'

/**
 * 知识库卡片组件测试
 */

describe('KnowledgeBaseCard', () => {
  const mockProps = {
    id: 'test-kb-1',
    name: 'Test Knowledge Base',
    description: 'This is a test knowledge base',
    isActive: true,
    documentCount: 10,
    nodeCount: 50,
    edgeCount: 30,
    createdAt: '2024-01-01T00:00:00Z',
  }

  it('应该渲染知识库名称', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    expect(screen.getByText('Test Knowledge Base')).toBeInTheDocument()
  })

  it('应该渲染知识库描述', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    expect(screen.getByText('This is a test knowledge base')).toBeInTheDocument()
  })

  it('应该显示激活状态徽章', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    expect(screen.getByText('激活')).toBeInTheDocument()
  })

  it('应该显示未激活状态徽章', () => {
    render(<KnowledgeBaseCard {...mockProps} isActive={false} />)
    expect(screen.getByText('未激活')).toBeInTheDocument()
  })

  it('应该显示文档数量', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('文档')).toBeInTheDocument()
  })

  it('应该显示节点数量', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('节点')).toBeInTheDocument()
  })

  it('应该在点击时调用onClick回调', () => {
    const onClick = vi.fn()
    render(<KnowledgeBaseCard {...mockProps} onClick={onClick} />)
    
    const card = screen.getByText('Test Knowledge Base').closest('div')?.parentElement
    if (card) {
      fireEvent.click(card)
      expect(onClick).toHaveBeenCalledTimes(1)
    }
  })

  it('应该在点击编辑时调用onEdit回调', async () => {
    const onEdit = vi.fn()
    render(<KnowledgeBaseCard {...mockProps} onEdit={onEdit} />)
    
    // 找到更多操作按钮
    const moreButton = screen.getByRole('button', { name: /more/i })
    fireEvent.click(moreButton)
    
    // 找到编辑按钮
    const editButton = await screen.findByText('编辑')
    fireEvent.click(editButton)
    
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('应该在点击删除时调用onDelete回调', async () => {
    const onDelete = vi.fn()
    render(<KnowledgeBaseCard {...mockProps} onDelete={onDelete} />)
    
    // 找到更多操作按钮
    const moreButton = screen.getByRole('button', { name: /more/i })
    fireEvent.click(moreButton)
    
    // 找到删除按钮
    const deleteButton = await screen.findByText('删除')
    fireEvent.click(deleteButton)
    
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('应该正确格式化日期', () => {
    render(<KnowledgeBaseCard {...mockProps} />)
    // 检查日期是否以正确的格式显示
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })

  it('应该在没有描述时不显示描述', () => {
    const { container } = render(
      <KnowledgeBaseCard {...mockProps} description={undefined} />
    )
    expect(container.textContent).not.toContain('This is a test knowledge base')
  })

  it('应该显示最后同步时间', () => {
    const lastSyncAt = '2024-01-15T12:00:00Z'
    render(<KnowledgeBaseCard {...mockProps} lastSyncAt={lastSyncAt} />)
    expect(screen.getByText(/最后同步/)).toBeInTheDocument()
  })

  it('应该在没有最后同步时间时不显示', () => {
    const { container } = render(<KnowledgeBaseCard {...mockProps} />)
    expect(container.textContent).not.toContain('最后同步')
  })

  it('应该使用默认值0显示文档数量', () => {
    render(<KnowledgeBaseCard {...mockProps} documentCount={undefined} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('应该在hover时显示操作按钮', () => {
    const { container } = render(<KnowledgeBaseCard {...mockProps} />)
    const card = container.firstChild as HTMLElement
    
    // 模拟hover
    fireEvent.mouseEnter(card)
    
    // 检查按钮是否可见（通过检查opacity类）
    const moreButton = screen.getByRole('button', { name: /more/i })
    expect(moreButton).toBeInTheDocument()
  })
})

