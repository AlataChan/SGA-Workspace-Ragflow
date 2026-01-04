/**
 * NextChat 遗留组件存根
 * 提供基本的类型兼容性，避免编译错误
 */
'use client'

import React from 'react'
import { Button as ShadcnButton } from '@/components/ui/button'

export interface IconButtonProps {
  onClick?: () => void
  icon?: React.ReactNode
  text?: string
  className?: string
  title?: string
  disabled?: boolean
  bordered?: boolean
  shadow?: boolean
  type?: 'primary' | 'danger' | 'text'
  tabIndex?: number
  autoFocus?: boolean
  style?: React.CSSProperties
}

export function IconButton({
  onClick,
  icon,
  text,
  className = '',
  title,
  disabled = false,
  type = 'text',
  style,
  ...props
}: IconButtonProps) {
  const variant = type === 'primary' ? 'default' : type === 'danger' ? 'destructive' : 'ghost'

  return (
    <ShadcnButton
      variant={variant}
      onClick={onClick}
      className={className}
      title={title}
      disabled={disabled}
      style={style}
      {...props}
    >
      {icon}
      {text && <span className="ml-1">{text}</span>}
    </ShadcnButton>
  )
}

export default IconButton
