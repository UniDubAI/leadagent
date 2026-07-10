'use client'

import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const t = useTranslations('Nav')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button onClick={handleLogout} className="text-sm text-white/70 hover:text-white">
      {t('logout')}
    </button>
  )
}
