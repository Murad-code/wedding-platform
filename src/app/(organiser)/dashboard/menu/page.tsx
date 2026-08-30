import type { Metadata } from 'next'
import Link from 'next/link'

import { AddMenuCourseForm } from '@/components/organiser/add-menu-course-form'
import { AddMenuOptionForm } from '@/components/organiser/add-menu-option-form'
import { DeleteMenuItemButton } from '@/components/organiser/delete-menu-item-button'
import { requireOrganiser } from '@/lib/auth/session'
import { getCateringReport, getMenu } from '@/lib/menu'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Menu' }
export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  await requireOrganiser()

  const [settings, menu, report] = await Promise.all([
    getWeddingSettings(),
    getMenu(),
    getCateringReport(),
  ])

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Menu</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-1 text-sm text-organiser-muted">
            {settings.features.menu
              ? 'Guests choose from these when they reply.'
              : 'Meal choices are switched off, so guests are not asked to choose.'}
          </p>
        </div>
        <Link
          href="/api/menu/export"
          prefetch={false}
          className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
        >
          Export for the caterer
        </Link>
      </header>

      <section className="mt-8" aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className="text-lg font-semibold">
          Numbers
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-4">
          {[
            ['Attending', report.attending],
            ['Adults', report.adults],
            ['Children', report.children],
            ['Infants', report.infants],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-organiser-border bg-organiser-surface p-4"
            >
              <dt className="text-sm text-organiser-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {report.tallies.length > 0 ? (
        <section className="mt-8" aria-labelledby="tally-heading">
          <h2 id="tally-heading" className="text-lg font-semibold">
            Choices so far
          </h2>
          <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {report.tallies.map((tally) => (
              <li
                key={tally.optionId}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
              >
                <span>
                  <span className="text-organiser-muted">{tally.courseName}</span>{' '}
                  <span className="font-medium">{tally.optionName}</span>
                </span>
                <span className="tabular-nums" data-tally-option={tally.optionId}>
                  {tally.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.guestsMissingChoices.length > 0 ? (
        <section className="mt-8" aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="text-lg font-semibold">
            Still to choose ({report.guestsMissingChoices.length})
          </h2>
          <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-status-pending/40 bg-status-pending/5">
            {report.guestsMissingChoices.map((guest) => (
              <li key={guest.guestId} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <Link href={`/dashboard/guests/${guest.guestId}`} className="hover:underline">
                  {guest.name}
                </Link>
                <span className="text-organiser-muted">{guest.missingCourses.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.guestsWithDietaryNeeds.length > 0 ? (
        <section className="mt-8" aria-labelledby="dietary-heading">
          <h2 id="dietary-heading" className="text-lg font-semibold">
            Dietary requirements and allergies ({report.guestsWithDietaryNeeds.length})
          </h2>
          <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {report.guestsWithDietaryNeeds.map((guest) => (
              <li key={guest.guestId} className="px-4 py-2.5 text-sm">
                <Link
                  href={`/dashboard/guests/${guest.guestId}`}
                  className="font-medium hover:underline"
                >
                  {guest.name}
                </Link>
                {guest.allergies ? (
                  <p className="text-status-declined">Allergies: {guest.allergies}</p>
                ) : null}
                {guest.dietaryRequirements ? (
                  <p className="text-organiser-muted">{guest.dietaryRequirements}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="courses-heading">
        <h2 id="courses-heading" className="text-lg font-semibold">
          Courses
        </h2>

        {menu.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-organiser-border p-8 text-center text-sm text-organiser-muted">
            No courses yet. Add a starter, a main, and a dessert, or a single course if you are
            serving one thing.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {menu.map((course) => (
              <article
                key={course.id}
                className="rounded-lg border border-organiser-border bg-organiser-surface p-4"
              >
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{course.name}</h3>
                    <p className="text-xs text-organiser-muted">
                      #{course.order}
                      {course.required ? ' · required' : ' · optional'}
                      {course.childrenOnly ? ' · children only' : ''}
                    </p>
                  </div>
                  <DeleteMenuItemButton kind="course" id={course.id} label={course.name} />
                </header>

                {course.options.length > 0 ? (
                  <ul className="mt-3 divide-y divide-organiser-border border-y border-organiser-border">
                    {course.options.map((option) => (
                      <li
                        key={option.id}
                        className="flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <span>
                          {option.name}
                          {option.isVegan ? (
                            <span className="ml-2 text-xs text-organiser-muted">vegan</span>
                          ) : option.isVegetarian ? (
                            <span className="ml-2 text-xs text-organiser-muted">vegetarian</span>
                          ) : null}
                          {option.isGlutenFree ? (
                            <span className="ml-2 text-xs text-organiser-muted">gluten-free</span>
                          ) : null}
                        </span>
                        <DeleteMenuItemButton kind="option" id={option.id} label={option.name} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-organiser-muted">
                    No options yet. Guests cannot choose this course until it has some.
                  </p>
                )}

                <AddMenuOptionForm courseId={course.id} courseName={course.name} className="mt-3" />
              </article>
            ))}
          </div>
        )}
      </section>

      <AddMenuCourseForm className="mt-6" nextOrder={(menu.at(-1)?.order ?? 0) + 10} />
    </div>
  )
}
