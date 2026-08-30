import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/guest/page-shell'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'FAQs' }
export const dynamic = 'force-dynamic'

export default async function FaqsPage() {
  const settings = await getWeddingSettings()
  // A disabled or empty section is absent rather than an empty page.
  if (!settings.isConfigured || !settings.features.faqs || settings.faqs.length === 0) {
    notFound()
  }

  return (
    <PageShell settings={settings} title="Questions" intro="A few things people often ask.">
      <dl className="space-y-8">
        {settings.faqs.map((faq) => (
          <div key={faq.question}>
            <dt className="font-guest-display text-xl">{faq.question}</dt>
            <dd className="mt-2 whitespace-pre-line text-guest-muted">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  )
}
