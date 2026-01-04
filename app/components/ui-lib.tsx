/**
 * NextChat 遗留组件存根
 * 提供基本的类型兼容性，避免编译错误
 */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Toast 通知
export function showToast(message: string, delay?: number) {
  // 简单的 console 实现，实际应用中可以集成更好的 toast 库
  console.log('[Toast]', message)
}

// 确认对话框
export function showConfirm(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmed = window.confirm(content)
    resolve(confirmed)
  })
}

// 图片模态框
export function showImageModal(src: string) {
  window.open(src, '_blank')
}

// 全屏组件
export function FullScreen({ children, className, right }: { children: React.ReactNode; className?: string; right?: number }) {
  return (
    <div className={`fixed inset-0 z-50 bg-background ${className || ''}`} style={right ? { right } : undefined}>
      {children}
    </div>
  )
}

// Modal 组件
interface ModalProps {
  title?: string
  children?: React.ReactNode
  onClose?: () => void
  actions?: React.ReactNode[]
  footer?: React.ReactNode
}

export function Modal({ title, children, onClose, actions, footer }: ModalProps) {
  return (
    <Dialog open={true} onOpenChange={() => onClose?.()}>
      <DialogContent>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div className="py-4">{children}</div>
        {(actions || footer) && (
          <DialogFooter>
            {footer || actions}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ListItem 组件
interface ListItemProps {
  title: string
  subTitle?: string
  children?: React.ReactNode
  className?: string
}

export function ListItem({ title, subTitle, children, className = '' }: ListItemProps) {
  return (
    <div className={`flex items-center justify-between py-3 border-b ${className}`}>
      <div>
        <div className="font-medium">{title}</div>
        {subTitle && <div className="text-sm text-muted-foreground">{subTitle}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

// Select 组件
interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
}

export function Select({ value, onChange, children, className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`border rounded px-2 py-1 ${className}`}
    >
      {children}
    </select>
  )
}

// PasswordInput 组件
interface PasswordInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export function PasswordInput({ value, onChange, placeholder, className = '' }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <Input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? '隐藏' : '显示'}
      </button>
    </div>
  )
}

// Popover 组件
interface PopoverProps {
  content: React.ReactNode
  children: React.ReactNode
  onClose?: () => void
}

export function Popover({ content, children, onClose }: PopoverProps) {
  return (
    <div className="relative">
      {children}
      <div className="absolute z-50 mt-2 p-4 bg-popover border rounded-md shadow-lg">
        {content}
      </div>
    </div>
  )
}

// Card 组件
interface CardProps {
  children?: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      {children}
    </div>
  )
}

// Loading 组件
export function Loading({ noLogo }: { noLogo?: boolean }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

export default {
  showToast,
  showConfirm,
  showImageModal,
  FullScreen,
  Modal,
  ListItem,
  Select,
  PasswordInput,
  Popover,
  Card,
  Loading,
}
