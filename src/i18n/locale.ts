import { cookies } from 'next/headers'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'
import { defaultLocale, isLocale, type Locale } from './config'

export const LOCALE_COOKIE = 'NEXT_LOCALE'

// Autentifikatsiyadan o'tgan foydalanuvchi uchun DB'dagi preferred_language
// asosiy manba hisoblanadi (barcha qurilmalarda bir xil bo'lishi uchun);
// login/signup kabi anonim sahifalarda faqat cookie ishlatiladi.
export async function getLocale(): Promise<Locale> {
  const user = await getUser()

  if (user) {
    const db = createServerClient()
    const { data } = await db
      .from('user_settings')
      .select('preferred_language')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.preferred_language && isLocale(data.preferred_language)) {
      return data.preferred_language
    }
  }

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale

  return defaultLocale
}
