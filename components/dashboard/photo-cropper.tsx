'use client'

// components/dashboard/photo-cropper.tsx
//
// Aspect-locked 4:5 cropper shown after a photo is chosen, before it uploads.
//
// The public card renders the photo as a full-bleed hero, so the framing has to
// be decided by a human. The previous flow just scaled the file to fit and kept
// whatever aspect was uploaded, which meant a landscape photo was cropped
// straight through the subject's face.
//
// Drag to reposition, slider or pinch to zoom. No new dependency: pointer
// events for the drag, two-pointer distance for pinch, canvas for the output.

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CROP_ASPECT,
  centreOffset,
  checkSourceResolution,
  clampOffset,
  coverScale,
  renderCrop,
  type Offset,
  type Size,
} from '@/lib/utils/crop'

interface PhotoCropperProps {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob, previewUrl: string) => void
}

/** Display size of the crop frame. 4:5, sized to fit a dashboard panel. */
const FRAME: Size = { width: 320, height: 320 / CROP_ASPECT }

const MAX_ZOOM = 4

export function PhotoCropper({ file, onCancel, onConfirm }: PhotoCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag + pinch state kept in refs: these change every pointermove and must
  // not trigger a re-render on their own.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragStart = useRef<{ x: number; y: number; offset: Offset } | null>(null)
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  const base = natural ? coverScale(natural, FRAME) : 1
  const scale = base * zoom

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleImageLoad = useCallback(() => {
    const el = imgRef.current
    if (!el) return
    const size = { width: el.naturalWidth, height: el.naturalHeight }

    // Reject before framing rather than after: there is no point letting
    // someone carefully position a photo that is going to look blurry anyway.
    const rejection = checkSourceResolution(size)
    if (rejection) {
      setError(rejection.message)
      setNatural(null)
      return
    }

    const s = coverScale(size, FRAME)
    setError(null)
    setNatural(size)
    setZoom(1)
    setOffset(centreOffset(size, FRAME, s))
  }, [])

  const applyOffset = useCallback(
    (next: Offset) => {
      if (!natural) return
      setOffset(clampOffset(next, natural, FRAME, scale))
    },
    [natural, scale]
  )

  // Re-clamp whenever zoom changes, keeping the frame's centre point stable so
  // zooming does not appear to drift.
  const applyZoom = useCallback(
    (nextZoom: number) => {
      if (!natural) return
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
      const nextScale = base * clampedZoom
      const ratio = nextScale / scale

      const cx = FRAME.width / 2
      const cy = FRAME.height / 2
      const next: Offset = {
        x: cx - (cx - offset.x) * ratio,
        y: cy - (cy - offset.y) * ratio,
      }

      setZoom(clampedZoom)
      setOffset(clampOffset(next, natural, FRAME, nextScale))
    },
    [natural, base, scale, offset]
  )

  function distanceBetweenPointers(): number {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      pinchStart.current = { distance: distanceBetweenPointers(), zoom }
      dragStart.current = null
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, offset }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const d = distanceBetweenPointers()
      if (d > 0) applyZoom(pinchStart.current.zoom * (d / pinchStart.current.distance))
      return
    }

    const start = dragStart.current
    if (!start) return
    applyOffset({
      x: start.offset.x + (e.clientX - start.x),
      y: start.offset.y + (e.clientY - start.y),
    })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) dragStart.current = null
  }

  async function handleConfirm() {
    const el = imgRef.current
    if (!el || !natural) return

    setBusy(true)
    setError(null)
    try {
      const blob = await renderCrop(el, offset, FRAME, scale)
      onConfirm(blob, URL.createObjectURL(blob))
    } catch {
      setError('Could not process that image. Please try another file.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-jakarta text-base font-semibold text-slate-800">
          Frame the photo
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Drag to reposition, pinch or use the slider to zoom. This exact crop is
          what shows on the card.
        </p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative touch-none overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
            style={{ width: FRAME.width, height: FRAME.height }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {objectUrl && (
              <img
                ref={imgRef}
                src={objectUrl}
                alt=""
                onLoad={handleImageLoad}
                draggable={false}
                className="absolute left-0 top-0 max-w-none select-none"
                style={{
                  width: natural ? natural.width * scale : 'auto',
                  height: natural ? natural.height * scale : 'auto',
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                  cursor: 'grab',
                }}
              />
            )}

            {/* Rule-of-thirds guides — purely visual, never drawn to the output */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-slate-400">
            zoom_out
          </span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={e => applyZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-teal-500"
            aria-label="Zoom"
          />
          <span className="material-symbols-outlined text-[18px] text-slate-400">
            zoom_in
          </span>
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !natural}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Use this crop'}
          </button>
        </div>
      </div>
    </div>
  )
}
