'use server'

import { cookies } from 'next/headers'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'
import { isLocale } from './config'
import { LOCALE_COOKIE } from './locale'

// Til almashtirgichdan chaqiriladi. Cookie har doim yangilanadi (anonim
// sahifalar — login/signup — uchun ham ishlashi kerak); autentifikatsiyadan
// o'tgan bo'lsa, tanlov user_settings'ga ham yoziladi (barcha qurilmalarda saqlanishi uchun).
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  const user = await getUser()
  if (user) {
    const db = createServerClient()
    await db
      .from('user_settings')
      .upsert({ user_id: user.id, preferred_language: locale }, { onConflict: 'user_id' })
  }
}
