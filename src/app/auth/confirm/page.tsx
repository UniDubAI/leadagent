'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const INVALID_LINK_ERROR = "Havola yaroqsiz yoki muddati o'tgan"

function AuthConfirmHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const confirm = async () => {
      const supabase = createClient()
      const next = searchParams.get('next') ?? '/update-password'

      // PKCE-style link: token_hash/type arrive as query params.
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as EmailOtpType | null

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash })
        router.replace(error ? `/login?error=${encodeURIComponent(INVALID_LINK_ERROR)}` : next)
        return
      }

      // Implicit-flow link (Supabase's default email template): tokens arrive
      // in the URL fragment, which the server never sees, so we read it here.
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        router.replace(error ? `/login?error=${encodeURIComponent(INVALID_LINK_ERROR)}` : next)
        return
      }

      router.replace(`/login?error=${encodeURIComponent(INVALID_LINK_ERROR)}`)
    }

    confirm()
  }, [router, searchParams])

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      <p className="text-sm text-gray-500">Tekshirilmoqda...</p>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirmHandler />
    </Suspense>
  )
}
