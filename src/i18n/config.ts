export const locales = ['uz', 'ru', 'en', 'kk', 'tr', 'az'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'uz'

export const localeLabels: Record<Locale, string> = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
  kk: 'Қазақша',
  tr: 'Türkçe',
  az: 'Azərbaycan',
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
