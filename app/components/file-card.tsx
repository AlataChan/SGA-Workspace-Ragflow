'use client'

import React from 'react'
import { Download, FileText, Image, File, Eye } from 'lucide-react'

interface FileCardProps {
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
  onDownload?: () => void
  onPreview?: () => void
}

const FileCard: React.FC<FileCardProps> = ({
  fileName,
  fileUrl,
  fileSize,
  fileType,
  onDownload,
  onPreview
}) => {
  // 获取文件图标
  const getFileIcon = () => {
    if (!fileType) return <File className="w-8 h-8 text-gray-500" />
    
    if (fileType.startsWith('image/')) {
      return <Image className="w-8 h-8 text-blue-500" />
    } else if (fileType.includes('document') || fileType.includes('word')) {
      return <FileText className="w-8 h-8 text-blue-600" />
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      return <FileText className="w-8 h-8 text-green-600" />
    } else {
      return <File className="w-8 h-8 text-gray-500" />
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '未知大小'
    
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  // 处理下载
  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else {
      // 强制下载行为
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = fileName
      link.target = '_blank'
      // 添加下载属性确保触发下载而不是预览
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // 判断文件是否可预览
  const isPreviewable = () => {
    if (!fileType) return false

    // 可预览的文件类型
    return (
      fileType.includes('pdf') ||
      fileType.startsWith('image/') ||
      fileType.includes('text/') ||
      fileType.includes('json') ||
      fileType.includes('xml') ||
      fileType.includes('html')
    )
  }

  // 判断是否只显示下载按钮（对于压缩包等）
  const isDownloadOnly = () => {
    if (!fileType) return false

    return (
      fileType.includes('zip') ||
      fileType.includes('rar') ||
      fileType.includes('7z') ||
      fileType.includes('tar') ||
      fileType.includes('gz') ||
      fileType.includes('exe') ||
      fileType.includes('msi')
    )
  }

  // 处理预览
  const handlePreview = () => {
    if (onPreview) {
      onPreview()
    } else {
      // 对于可预览的文件，在新窗口打开
      if (isPreviewable()) {
        window.open(fileUrl, '_blank')
      } else {
        // 对于不可预览的文件，尝试打开（可能会触发下载）
        window.open(fileUrl, '_blank')
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-sm">
      <div className="flex items-start space-x-3">
        {/* 文件图标 */}
        <div className="flex-shrink-0">
          {getFileIcon()}
        </div>
        
        {/* 文件信息 */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate" title={fileName}>
            {fileName}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(fileSize)}
          </p>
          {fileType && (
            <p className="text-xs text-gray-400 mt-1">
              {fileType}
            </p>
          )}
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex space-x-2 mt-3">
        {isDownloadOnly() ? (
          // 只显示下载按钮（压缩包等）
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors duration-200"
          >
            <Download className="w-4 h-4 mr-1" />
            下载
          </button>
        ) : isPreviewable() ? (
          // 可预览文件：显示预览和下载
          <>
            <button
              onClick={handlePreview}
              className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors duration-200"
            >
              <Eye className="w-4 h-4 mr-1" />
              预览
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </button>
          </>
        ) : (
          // 其他文件：显示打开和下载
          <>
            <button
              onClick={handlePreview}
              className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors duration-200"
            >
              <Eye className="w-4 h-4 mr-1" />
              打开
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default FileCard
