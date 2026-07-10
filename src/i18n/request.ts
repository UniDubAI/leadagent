import { getRequestConfig } from 'next-intl/server'
import { getLocale } from './locale'

// URL segmentlarsiz (masalan /leads, [locale]/leads emas) i18n — locale
// cookie/DB'dan aniqlanadi, shuning uchun mavjud routinglar o'zgarmaydi.
export default getRequestConfig(async () => {
  const locale = await getLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
