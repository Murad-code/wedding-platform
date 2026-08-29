import Link from 'next/link'

import { cn } from '@/lib/cn'

const STEPS = [
  {
    title: 'Add your wedding details',
    why: 'Your names, the date, and the venues drive the whole guest website.',
    href: '/dashboard/settings',
    action: 'Add details',
  },
  {
    title: 'Build your guest list',
    why: 'Group people into invitation parties — households respond together.',
    href: '/dashboard/guests',
    action: 'Add guests',
  },
  {
    title: 'Send invitations',
    why: 'Each party gets a private link. No guest can see another party’s invitation.',
    href: '/dashboard/parties',
    action: 'Review invitations',
  },
]

/**
 * A brand-new deployment has nothing in it. Showing empty tables first would be a poor
 * first impression, so this replaces them until the wedding is configured (docs/UX.md §3.1).
 */
export function SetupChecklist({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="setup-heading"
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-6',
        className,
      )}
    >
      <h2 id="setup-heading" className="text-lg font-semibold">
        Let’s set up your wedding
      </h2>
      <p className="mt-1 text-sm text-organiser-muted">
        Three steps to a working wedding website and invitations.
      </p>

      <ol className="mt-5 space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.href} className="flex gap-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-organiser-border text-xs font-semibold"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-organiser-muted">{step.why}</p>
            </div>
            <Link
              href={step.href}
              className="self-center rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:bg-organiser-bg"
            >
              {step.action}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
