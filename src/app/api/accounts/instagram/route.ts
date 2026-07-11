import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUser } from '@/lib/supabase/server'
import { revokeInstagramAccess } from '@/lib/instagram'

export async function DELETE() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()
  const { data: account } = await db
    .from('connected_accounts')
    .select('access_token, data')
    .eq('user_id', user.id)
    .eq('platform', 'instagram')
    .maybeSingle()

  if (account?.access_token) {
    const igUserId = (account.data as { id?: string } | null)?.id
    if (igUserId) await revokeInstagramAccess(account.access_token, igUserId)
  }

  const { error } = await db
    .from('connected_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', 'instagram')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
