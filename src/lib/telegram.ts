export interface TelegramChannelStats {
  username: string
  title: string
  description: string | null
  members_count: number
}

export class TelegramChannelError extends Error {}

export async function getTelegramChannelStats(rawUsername: string): Promise<TelegramChannelStats> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new TelegramChannelError('TELEGRAM_BOT_TOKEN sozlanmagan')

  const username = rawUsername.trim().replace(/^@/, '')
  if (!username) throw new TelegramChannelError('Kanal username kiritilmagan')
  const chatId = `@${username}`

  const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`)
  const chatData = await chatRes.json()

  if (!chatData.ok) {
    throw new TelegramChannelError(
      `Kanal topilmadi yoki bot unga qo'shilmagan. @leadagent_notify_bot'ni kanalingizga administrator sifatida qo'shib, qayta urinib ko'ring. (${chatData.description ?? 'Telegram xatolik qaytardi'})`,
    )
  }

  const countRes = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`)
  const countData = await countRes.json()

  if (!countData.ok) {
    throw new TelegramChannelError(
      `Obunachilar sonini olishning imkoni bo'lmadi. @leadagent_notify_bot'ni kanalingizga administrator sifatida qo'shib, qayta urinib ko'ring. (${countData.description ?? 'Telegram xatolik qaytardi'})`,
    )
  }

  return {
    username: chatId,
    title: chatData.result.title ?? chatId,
    description: chatData.result.description ?? null,
    members_count: countData.result as number,
  }
}

export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[telegram] sendMessage error:', err instanceof Error ? err.message : err)
  }
}
