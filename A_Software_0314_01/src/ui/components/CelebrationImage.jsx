import React, { useCallback, useRef, useState } from 'react'
import { mediaAssets } from '../mediaAssets.js'

/**
 * 先请求 .gif（真 GIF 会循环播放）；若文件不存在或加载失败则回退到 .jpg。
 * 将动图放到 public/media/all-games-celebration.gif 即可，无需改代码。
 */
export function CelebrationImage({
  frameClassName = '',
  imageClassName = '',
  alt = '',
  adaptAspect = false,
}) {
  const frameRef = useRef(null)
  const [src, setSrc] = useState(mediaAssets.allGamesCelebrationGif)

  const onError = useCallback(() => {
    setSrc((current) =>
      current.endsWith('.gif') ? mediaAssets.allGamesCelebrationStill : current,
    )
  }, [])

  const onLoad = useCallback(
    (e) => {
      if (!adaptAspect || !frameRef.current) return
      const { naturalWidth, naturalHeight } = e.currentTarget
      if (naturalWidth > 0 && naturalHeight > 0) {
        frameRef.current.style.aspectRatio = `${naturalWidth} / ${naturalHeight}`
      }
    },
    [adaptAspect],
  )

  return (
    <div ref={frameRef} className={frameClassName}>
      <img
        src={src}
        alt={alt}
        className={imageClassName}
        onError={onError}
        onLoad={onLoad}
      />
    </div>
  )
}
