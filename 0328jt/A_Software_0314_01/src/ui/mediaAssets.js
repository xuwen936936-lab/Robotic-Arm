/**
 * 静态素材统一入口（文件放在 public/ 下，这里只写 URL 路径）。
 * 以后要换图：替换 public 里的文件，或改这里的路径即可。
 */
export const mediaAssets = {
  /** 右侧「3D ROBOT MODEL」卡片：真实机械臂预览照 */
  robot3dPreview: '/media/robot-3d-preview.png',

  /** Install 步骤：工具安装引导图（左→右 1、2、3） */
  installToolGuide: [
    { src: '/install-tool-guide/1.png', alt: 'Tool installation step 1' },
    { src: '/install-tool-guide/2.png', alt: 'Tool installation step 2' },
    { src: '/install-tool-guide/3.png', alt: 'Tool installation step 3' },
  ],

  /** Test 页碰撞提示弹窗里的示意图 */
  toolTestHintIllustration: '/placeholders/chopsticks-illustration.svg',

  /**
   * 庆祝动图路径（浏览器对 GIF 会自动循环）。
   * 请把「真正的」GIF 放在 public/media/all-games-celebration.gif。
   * 若尚未提供 GIF，会 404 后自动回退到 allGamesCelebrationStill。
   */
  allGamesCelebrationGif: '/media/all-games-celebration.gif',

  /** 静帧备用（JPEG，扩展名与内容一致，避免伪 .gif 无法动画） */
  allGamesCelebrationStill: '/media/all-games-celebration.jpg',

  /** @deprecated 使用 <CelebrationImage />，保留路径供检索 */
  assemblyCelebrationGif: '/media/all-games-celebration.gif',

  /** Execute 页右侧「3D ROBOT MODEL」虚线框内：体素狮子，居中 cover 裁剪 */
  lionVoxelAutoRun: '/media/lion-voxel-auto-run.png',

  /** Execute 页安全区域示意图 */
  executionWarningMapClean: '/placeholders/execution-warning-map-clean.png',
}
