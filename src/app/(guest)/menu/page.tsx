import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/guest/page-shell'
import { getMenu } from '@/lib/menu'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Menu' }
export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured || !settings.features.menu) notFound()

  const menu = (await getMenu()).filter((course) => course.options.length > 0)
  if (menu.length === 0) notFound()

  return (
    <PageShell
      settings={settings}
      title="What we’ll be eating"
      intro="You’ll be asked to choose when you reply to your invitation."
    >
      <div className="space-y-10">
        {menu.map((course) => (
          <section key={course.id} aria-labelledby={`course-${course.id}`}>
            <h2 id={`course-${course.id}`} className="font-guest-display text-2xl">
              {course.name}
            </h2>
            {course.description ? (
              <p className="mt-1 text-guest-muted">{course.description}</p>
            ) : null}

            <ul className="mt-4 space-y-4">
              {course.options.map((option) => (
                <li key={option.id}>
                  <p className="font-medium">
                    {option.name}
                    {option.isVegan ? (
                      <span className="ml-2 text-xs tracking-wide text-guest-muted uppercase">
                        vegan
                      </span>
                    ) : option.isVegetarian ? (
                      <span className="ml-2 text-xs tracking-wide text-guest-muted uppercase">
                        vegetarian
                      </span>
                    ) : null}
                    {option.isGlutenFree ? (
                      <span className="ml-2 text-xs tracking-wide text-guest-muted uppercase">
                        gluten free
                      </span>
                    ) : null}
                  </p>
                  {option.description ? (
                    <p className="mt-0.5 text-guest-muted">{option.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  )
}
