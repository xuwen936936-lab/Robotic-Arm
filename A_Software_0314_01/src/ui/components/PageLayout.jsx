import React from 'react'

/**
 * 全局页面布局：紫色编织背景 + 居中内容区。
 * 内容区最大宽度在此统一配置，修改此处即可让所有使用本布局的页面生效。
 */
const CONTENT_MAX_WIDTH = 1280

export function PageLayout({ children, className = '' }) {
  return (
    <div
      className={`h-screen w-full weave flex flex-col overflow-hidden pt-8 px-8 pb-6 ${className}`}
    >
      <div
        className="w-full min-h-0 mx-auto flex flex-col flex-1"
        style={{ maxWidth: CONTENT_MAX_WIDTH }}
      >
        {children}
      </div>
    </div>
  )
}
