const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i

export const YOLO_VIDEOS = {
  'PSI-69': {
    src: import.meta.env.BASE_URL + 'psi69.mp4',
    title: 'YOLO Computer Vision · PSI-69',
    model: 'YOLOv26n Combustion',
  },
  'PSI-10': {
    src: import.meta.env.BASE_URL + 'psi10.jpg',
    title: 'Representative Image Flame Design Flame Stages',
    model: 'None',
  },
}

export function getYoloVideo(psiId) {
  if (!psiId) return null
  const item = YOLO_VIDEOS[String(psiId).trim().toUpperCase()]
  if (!item) return null

  const isImage = item.type === 'image' || IMAGE_EXTENSIONS.test(item.src || '')
  return {
    ...item,
    isImage,
    badge: isImage ? 'Photo' : 'Video',
  }
}