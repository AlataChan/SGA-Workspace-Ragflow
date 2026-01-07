"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Bot, Loader2, Palette, Shuffle } from "lucide-react"

interface AvatarGeneratorProps {
  name: string
  onSelect: (url: string) => void
  className?: string
}

interface AvatarPreview {
  style: string
  url: string
  name: string
}

export function AvatarGenerator({ name, onSelect, className = "" }: AvatarGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previews, setPreviews] = useState<AvatarPreview[]>([])
  const [selectedStyle, setSelectedStyle] = useState('initials')
  const [customName, setCustomName] = useState(name)
  const [size, setSize] = useState(200)
  const [background, setBackground] = useState('6a5acd')
  const [color, setColor] = useState('ffffff')

  const generatePreviews = async () => {
    if (!customName.trim()) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/admin/agents/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: customName,
          style: selectedStyle,
          size,
          background,
          color
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPreviews(data.previews || [])
      } else {
        console.error('生成头像失败')
      }
    } catch (error) {
      console.error('生成头像错误:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelect = (url: string) => {
    onSelect(url)
    setIsOpen(false)
  }

  const generateQuickAvatar = () => {
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=6a5acd&color=ffffff&format=png&rounded=true&bold=true`
    onSelect(avatarUrl)
  }

  const randomColors = [
    { bg: '6a5acd', color: 'ffffff', name: '紫色' },
    { bg: '4f46e5', color: 'ffffff', name: '靛蓝' },
    { bg: '059669', color: 'ffffff', name: '绿色' },
    { bg: 'dc2626', color: 'ffffff', name: '红色' },
    { bg: 'ea580c', color: 'ffffff', name: '橙色' },
    { bg: '0891b2', color: 'ffffff', name: '青色' },
    { bg: 'be185d', color: 'ffffff', name: '粉色' },
    { bg: '7c3aed', color: 'ffffff', name: '紫罗兰' }
  ]

  return (
    <div className={className}>
      <div className="flex space-x-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateQuickAvatar}
        >
          <Bot className="w-4 h-4 mr-2" />
          快速生成
        </Button>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
            >
              <Palette className="w-4 h-4 mr-2" />
              高级生成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>头像生成器</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* 配置区域 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>名称</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="输入名称"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>风格</Label>
                  <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initials">字母头像</SelectItem>
                      <SelectItem value="robohash">机器人风格</SelectItem>
                      <SelectItem value="identicon">几何图案</SelectItem>
                      <SelectItem value="bottts">机器人头像</SelectItem>
                      <SelectItem value="avataaars">卡通头像</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 颜色配置 (仅字母头像) */}
              {selectedStyle === 'initials' && (
                <div className="space-y-3">
                  <Label>颜色主题</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {randomColors.map((colorScheme, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBackground(colorScheme.bg)
                          setColor(colorScheme.color)
                        }}
                        className="border-border h-8 hover:opacity-90"
                        style={{
                          backgroundColor: `#${colorScheme.bg}`,
                          color: `#${colorScheme.color}`
                        }}
                      >
                        {colorScheme.name}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>背景色</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={background}
                          onChange={(e) => setBackground(e.target.value.replace('#', ''))}
                          placeholder="6a5acd"
                        />
                        <div 
                          className="w-10 h-10 rounded border border-border"
                          style={{ backgroundColor: `#${background}` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>文字色</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={color}
                          onChange={(e) => setColor(e.target.value.replace('#', ''))}
                          placeholder="ffffff"
                        />
                        <div 
                          className="w-10 h-10 rounded border border-border"
                          style={{ backgroundColor: `#${color}` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 生成按钮 */}
              <Button
                onClick={generatePreviews}
                disabled={isGenerating || !customName.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4 mr-2" />
                    生成头像预览
                  </>
                )}
              </Button>

              {/* 预览区域 */}
              {previews.length > 0 && (
                <div className="space-y-3">
                  <Label>选择头像</Label>
                  <div className="grid grid-cols-5 gap-3">
                    {previews.map((preview, index) => (
                      <div key={index} className="text-center space-y-2">
                        <button
                          onClick={() => handleSelect(preview.url)}
                          className="w-16 h-16 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors"
                        >
                          <img
                            src={preview.url}
                            alt={preview.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="text-xs text-muted-foreground">{preview.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
