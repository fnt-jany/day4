import { useEffect, useRef } from 'react'

const KAKAO_ADFIT_UNIT = import.meta.env.VITE_KAKAO_ADFIT_UNIT ?? ''
const KAKAO_ADFIT_WIDTH = import.meta.env.VITE_KAKAO_ADFIT_WIDTH ?? '320'
const KAKAO_ADFIT_HEIGHT = import.meta.env.VITE_KAKAO_ADFIT_HEIGHT ?? '100'

type AdFitSlotProps = {
  className?: string
}

function AdFitSlot({ className = '' }: AdFitSlotProps) {
  const slotRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!KAKAO_ADFIT_UNIT || !slotRef.current) {
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js'
    script.dataset.day4Adfit = 'true'
    slotRef.current.appendChild(script)
  }, [])

  if (!KAKAO_ADFIT_UNIT) {
    return null
  }

  return (
    <aside ref={slotRef} className={`guest-adfit-card ${className}`.trim()} aria-label="Advertisement">
      <ins
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit={KAKAO_ADFIT_UNIT}
        data-ad-width={KAKAO_ADFIT_WIDTH}
        data-ad-height={KAKAO_ADFIT_HEIGHT}
      />
    </aside>
  )
}

export default AdFitSlot
