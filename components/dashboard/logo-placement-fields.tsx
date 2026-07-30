'use client'

// components/dashboard/logo-placement-fields.tsx
//
// The "Card Design" controls: where the company logo sits on this card, and
// how big it is.
//
// Shared by the admin card editor and the staff my-card editor rather than
// written twice. The two card editors have drifted from each other before, and
// a control that means one thing in one place and another elsewhere is worse
// than no control.
//
// Behaviour worth stating plainly, because it is the thing people get wrong:
// position only applies when the card has a photo. Without a photo the logo
// replaces the initials and fills the centre of the hero, so there is no corner
// to move it to. The UI says so rather than leaving a dead control on screen.

import {
  LOGO_POSITION_LABELS,
  LOGO_POSITION_VALUES,
  LOGO_SIZES,
  LOGO_SIZE_VALUES,
  type LogoPosition,
  type LogoSize,
} from '@/lib/constants/logo-size'

interface LogoPlacementFieldsProps {
  /** Whether the company has a logo at all — without one there is nothing to place. */
  hasLogo: boolean
  /** Whether this card currently has a photo, including one not yet uploaded. */
  hasPhoto: boolean
  position: LogoPosition
  onPositionChange: (value: LogoPosition) => void
  /** null means inherit the company's branding setting. */
  size: LogoSize | null
  onSizeChange: (value: LogoSize | null) => void
}

function Segmented<T extends string | null>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div
      className={[
        'inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
              disabled ? 'cursor-not-allowed' : '',
              active
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function LogoPlacementFields({
  hasLogo,
  hasPhoto,
  position,
  onPositionChange,
  size,
  onSizeChange,
}: LogoPlacementFieldsProps) {
  if (!hasLogo) {
    return (
      <p className="text-sm text-slate-500">
        No company logo uploaded yet. Add one under{' '}
        <span className="font-semibold text-slate-600">Branding</span> and these
        controls will appear.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Logo Position
        </label>
        <p className="mb-3 text-xs text-slate-500">
          {hasPhoto
            ? 'Where the logo sits over the photo. Move it away from the face or a busy corner.'
            : 'Only applies once this card has a photo. With no photo the logo replaces the initials in the centre.'}
        </p>
        <Segmented
          disabled={!hasPhoto}
          value={position}
          onChange={onPositionChange}
          options={LOGO_POSITION_VALUES.map(v => ({
            value: v,
            label: LOGO_POSITION_LABELS[v],
          }))}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Logo Size
        </label>
        <p className="mb-3 text-xs text-slate-500">
          Overrides the company default for this card only.
        </p>
        <Segmented<LogoSize | null>
          value={size}
          onChange={onSizeChange}
          options={[
            { value: null, label: 'Default' },
            ...LOGO_SIZE_VALUES.map(v => ({
              value: v as LogoSize | null,
              label: LOGO_SIZES[v].label,
            })),
          ]}
        />
      </div>
    </div>
  )
}
