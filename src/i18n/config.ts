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

// Date/number formatting (toLocaleDateString va h.k.) uchun BCP47 teglari.
export const localeToBCP47: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
  tr: 'tr-TR',
  az: 'az-AZ',
}
