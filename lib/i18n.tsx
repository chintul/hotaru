'use client'

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { categoryName, type Lang } from './category-names.ts'

export type { Lang }

const STORAGE_KEY = 'hotaru-lang'
const CHANGE_EVENT = 'hotaru-lang-change'

let memoryLang: Lang = 'mn'

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

const readLang = (): Lang => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'mn') return saved
  } catch {}
  return memoryLang
}

const serverLang = (): Lang => 'mn'

export function setLang(next: Lang) {
  memoryLang = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, serverLang)
}

export type Translate = (mn: string, en: string) => string

export function useT(): Translate {
  const lang = useLang()
  return (mn, en) => (lang === 'en' ? en : mn)
}

export function T({ mn, en }: { mn: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'en' ? en : mn}</>
}

export function LangSync() {
  const lang = useLang()
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}

export { categoryName }

export function CategoryName({ slug, mn }: { slug: string; mn: string }) {
  return <>{categoryName(slug, mn, useLang())}</>
}

export function LangSwitch({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const lang = useLang()
  return (
    <div
      role="group"
      aria-label={lang === 'en' ? 'Language' : 'Хэл'}
      className={`inline-flex gap-0.5 rounded-full border border-line bg-paper p-[3px] ${className}`}
    >
      {(['mn', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`${compact ? 'min-h-8 min-w-9 px-2 text-[11px]' : 'min-h-10 min-w-11 px-2.5 text-[12px]'} rounded-full font-semibold text-ink-soft transition-colors aria-pressed:bg-primary-strong aria-pressed:text-on-primary`}
        >
          {code === 'mn' ? 'МН' : 'EN'}
        </button>
      ))}
    </div>
  )
}
