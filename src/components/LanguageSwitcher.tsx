'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { locales, localeLabels } from '@/i18n/config'
import { setLocale } from '@/i18n/actions'

// Native <select><option> rang kontrasti ko'p brauzer/OS'da ishonchsiz
// (masalan tungi rejimda option matni fon bilan qo'shilib ketishi mumkin) —
// shuning uchun to'liq nazorat qilinadigan oddiy dropdown ishlatiladi.
export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('Nav')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const choose = (next: string) => {
    setOpen(false)
    if (next === locale) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-label={t('language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="bg-primary-500 text-white text-xs border border-white/30 rounded px-2 py-1 hover:bg-primary-600 transition disabled:opacity-50 flex items-center gap-1"
      >
        {localeLabels[locale as keyof typeof localeLabels]}
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 min-w-[140px] bg-white border border-line rounded-lg shadow-lg overflow-hidden z-50 py-1"
        >
          {locales.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button
                type="button"
                onClick={() => choose(l)}
                className={`w-full text-left px-3 py-1.5 text-sm transition ${
                  l === locale
                    ? 'bg-primary-500 text-white'
                    : 'text-ink hover:bg-line/60'
                }`}
              >
                {localeLabels[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
