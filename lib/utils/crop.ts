// lib/utils/crop.ts
//
// Geometry for the 4:5 photo cropper. Pure functions, no DOM — the maths that
// maps what the user sees in the frame back to source pixels is the part worth
// testing, so it lives apart from the component.
//
// Model: the image is laid over a fixed-aspect frame at `scale`, positioned by
// `offset` (the image's top-left corner relative to the frame's top-left, in
// display pixels). Both offsets are <= 0 and are clamped so the image always
// covers the frame — the user can never drag a blank edge into shot.

/** Staff photos render into a full-bleed 4:5 hero. */
export const CROP_ASPECT = 4 / 5

/** Output size. 4:5, and large enough for a full-bleed hero on a 3x phone. */
export const CROP_OUTPUT_WIDTH = 800
export const CROP_OUTPUT_HEIGHT = 1000

/**
 * Smallest source we will accept.
 *
 * coverScale deliberately scales UP so a small image still fills the frame —
 * necessary, but it means a 200x150 photo technically "works" while rendering
 * as a blurry mess across 56% of the card. This is the last obvious way a
 * well-meaning staff member can ship a bad card, so it is caught at upload
 * rather than discovered on a printed card.
 *
 * Set against the crop frame, not the output: the user can zoom in, so the
 * usable region is smaller than the whole image.
 */
export const MIN_SOURCE_WIDTH = 500
export const MIN_SOURCE_HEIGHT = 625

export interface PhotoRejection {
  reason: 'too-small'
  message: string
}

/** Returns null when the image is usable, or a rejection to show the user. */
export function checkSourceResolution(natural: Size): PhotoRejection | null {
  if (natural.width >= MIN_SOURCE_WIDTH && natural.height >= MIN_SOURCE_HEIGHT) {
    return null
  }
  return {
    reason: 'too-small',
    message: `That photo is ${Math.round(natural.width)}×${Math.round(
      natural.height
    )}px, which will look blurry at card size. Please use one at least ${MIN_SOURCE_WIDTH}×${MIN_SOURCE_HEIGHT}px — most phone cameras are well above this.`,
  }
}

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Smallest scale at which `natural` fully covers `frame`.
 * Zoom is expressed as a multiplier on top of this, so zoom = 1 always fits.
 */
export function coverScale(natural: Size, frame: Size): number {
  if (natural.width <= 0 || natural.height <= 0) return 1
  return Math.max(frame.width / natural.width, frame.height / natural.height)
}

/** Displayed size of the image at a given scale. */
export function scaledSize(natural: Size, scale: number): Size {
  return { width: natural.width * scale, height: natural.height * scale }
}

/**
 * Clamp an offset so the image still covers the frame on all four sides.
 *
 * Without this the user could drag the photo away from an edge and bake a
 * transparent strip into the saved image.
 */
export function clampOffset(
  offset: Offset,
  natural: Size,
  frame: Size,
  scale: number
): Offset {
  const { width: dw, height: dh } = scaledSize(natural, scale)
  return {
    x: Math.min(0, Math.max(frame.width - dw, offset.x)),
    y: Math.min(0, Math.max(frame.height - dh, offset.y)),
  }
}

/** Offset that centres the image in the frame. */
export function centreOffset(natural: Size, frame: Size, scale: number): Offset {
  const { width: dw, height: dh } = scaledSize(natural, scale)
  return {
    x: (frame.width - dw) / 2,
    y: (frame.height - dh) / 2,
  }
}

/**
 * Map the on-screen frame back to a rectangle in the source image's own pixels,
 * ready to hand to canvas drawImage().
 */
export function toSourceRect(
  offset: Offset,
  frame: Size,
  scale: number
): SourceRect {
  return {
    sx: -offset.x / scale,
    sy: -offset.y / scale,
    sw: frame.width / scale,
    sh: frame.height / scale,
  }
}

/**
 * Render the cropped region to a 4:5 JPEG blob.
 *
 * Replaces the old resizePhoto(), which scaled to fit and preserved whatever
 * aspect was uploaded — fine for the old circular avatar, but in a full-bleed
 * hero a landscape photo gets cropped straight through the subject's face.
 */
export async function renderCrop(
  image: HTMLImageElement,
  offset: Offset,
  frame: Size,
  scale: number,
  quality = 0.85
): Promise<Blob> {
  const { sx, sy, sw, sh } = toSourceRect(offset, frame, scale)

  const canvas = document.createElement('canvas')
  canvas.width = CROP_OUTPUT_WIDTH
  canvas.height = CROP_OUTPUT_HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    CROP_OUTPUT_WIDTH,
    CROP_OUTPUT_HEIGHT
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality
    )
  })
}
