'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { coursesForGuest, type MealSelection, type MenuCourse } from '@/domain/menu/menu'
import type { RsvpStatus } from '@/domain/rsvp/status'
import type { ResolvedParty } from '@/lib/invitations'

type GuestAnswer = {
  rsvpStatus: RsvpStatus
  dietaryRequirements: string
  allergies: string
  accessibilityNeeds: string
  /** Chosen option id per course id. */
  meals: Record<number, number>
}

function initialAnswers(
  party: ResolvedParty,
  selections: Record<number, MealSelection[]>,
): Record<number, GuestAnswer> {
  return Object.fromEntries(
    party.guests.map((guest) => [
      guest.id,
      {
        rsvpStatus: guest.rsvpStatus,
        dietaryRequirements: guest.dietaryRequirements ?? '',
        allergies: guest.allergies ?? '',
        accessibilityNeeds: guest.accessibilityNeeds ?? '',
        meals: Object.fromEntries(
          (selections[guest.id] ?? []).map((s) => [s.courseId, s.optionId]),
        ),
      },
    ]),
  )
}

export function RsvpForm({
  party,
  token,
  hasResponded,
  menu = [],
  selections = {},
  smsEnabled = false,
}: {
  party: ResolvedParty
  token: string
  hasResponded: boolean
  menu?: MenuCourse[]
  selections?: Record<number, MealSelection[]>
  /**
   * Whether this wedding sends texts. When it does not, no phone number is asked for at
   * all — collecting one we will never use is exactly what data minimisation forbids
   * (docs/SECURITY.md §7).
   */
  smsEnabled?: boolean
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<number, GuestAnswer>>(() =>
    initialAnswers(party, selections),
  )
  const [message, setMessage] = useState(party.messageToCouple ?? '')
  const [email, setEmail] = useState(party.contactEmail ?? '')
  const [phone, setPhone] = useState(party.contactPhone ?? '')
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  function setAnswer(guestId: number, patch: Partial<GuestAnswer>) {
    setAnswers((current) => {
      const existing = current[guestId]
      if (!existing) return current
      return { ...current, [guestId]: { ...existing, ...patch } }
    })
    setSaved(false)
  }

  const answered = party.guests.filter(
    (guest) => answers[guest.id]?.rsvpStatus !== 'pending',
  ).length

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const responses = party.guests
      .map((guest) => ({ guest, answer: answers[guest.id] }))
      .filter(({ answer }) => answer && answer.rsvpStatus !== 'pending')

    if (responses.length === 0) {
      setError('Please let us know for at least one person.')
      return
    }

    setPending(true)

    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        messageToCouple: message,
        contactEmail: email,
        contactPhone: smsEnabled ? phone : '',
        smsConsent: smsEnabled && smsConsent && phone.trim().length > 0,
        guests: responses.map(({ guest, answer }) => ({
          guestId: guest.id,
          rsvpStatus: answer!.rsvpStatus,
          // Only meaningful for attending guests; the server ignores the rest.
          dietaryRequirements: answer!.dietaryRequirements,
          allergies: answer!.allergies,
          accessibilityNeeds: answer!.accessibilityNeeds,
          mealSelections: Object.entries(answer!.meals).map(([courseId, optionId]) => ({
            courseId: Number(courseId),
            optionId,
          })),
        })),
      }),
    })

    setPending(false)

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'We could not save your response. Please try again.')
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-status-declined/40 bg-status-declined/5 px-4 py-3 text-sm text-status-declined"
        >
          {error}
        </p>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="rounded-xl border border-status-attending/40 bg-status-attending/5 px-4 py-3 text-sm text-status-attending"
        >
          Thank you. Your reply has been saved. You can change it any time before the deadline.
        </p>
      ) : null}

      <ul className="space-y-5">
        {party.guests.map((guest) => {
          const answer = answers[guest.id]
          if (!answer) return null
          const attending = answer.rsvpStatus === 'attending'

          return (
            <li
              key={guest.id}
              className="rounded-2xl border border-guest-border bg-guest-surface p-5"
            >
              <fieldset>
                <legend className="font-guest-display text-xl">
                  {guest.displayName}
                  {guest.isPlusOne ? (
                    <span className="ml-2 align-middle text-xs text-guest-muted">(plus one)</span>
                  ) : null}
                </legend>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ChoiceButton
                    name={`status-${guest.id}`}
                    checked={attending}
                    onChange={() => setAnswer(guest.id, { rsvpStatus: 'attending' })}
                    tone="attending"
                  >
                    Yes, I'll be there
                  </ChoiceButton>
                  <ChoiceButton
                    name={`status-${guest.id}`}
                    checked={answer.rsvpStatus === 'declined'}
                    onChange={() => setAnswer(guest.id, { rsvpStatus: 'declined' })}
                    tone="declined"
                  >
                    Sorry, I can't make it
                  </ChoiceButton>
                </div>

                {/* Only ask attending guests for details — nobody should fill in a
                    dietary requirement for a meal they are not eating. */}
                {attending ? (
                  <div className="mt-5 space-y-4">
                    {coursesForGuest(menu, guest.ageGroup).map((course) => (
                      <fieldset key={course.id}>
                        <legend className="text-sm font-medium">
                          {course.name}
                          {course.required ? null : (
                            <span className="ml-1 text-guest-muted">(optional)</span>
                          )}
                        </legend>
                        {course.description ? (
                          <p className="mt-0.5 text-sm text-guest-muted">{course.description}</p>
                        ) : null}
                        <div className="mt-2 space-y-2">
                          {course.options.map((option) => (
                            <label
                              key={option.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                                answer.meals[course.id] === option.id
                                  ? 'border-guest-ink/40 bg-guest-bg'
                                  : 'border-guest-border'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`meal-${guest.id}-${course.id}`}
                                checked={answer.meals[course.id] === option.id}
                                onChange={() =>
                                  setAnswer(guest.id, {
                                    meals: { ...answer.meals, [course.id]: option.id },
                                  })
                                }
                                className="mt-1"
                              />
                              <span>
                                <span className="font-medium">{option.name}</span>
                                {option.description ? (
                                  <span className="block text-guest-muted">
                                    {option.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}

                    <Field
                      id={`diet-${guest.id}`}
                      label="Dietary requirements"
                      value={answer.dietaryRequirements}
                      onChange={(value) => setAnswer(guest.id, { dietaryRequirements: value })}
                      placeholder="Vegetarian, coeliac, and so on"
                    />
                    <Field
                      id={`allergies-${guest.id}`}
                      label="Allergies"
                      value={answer.allergies}
                      onChange={(value) => setAnswer(guest.id, { allergies: value })}
                      placeholder="Anything the caterer must know"
                    />
                    <Field
                      id={`access-${guest.id}`}
                      label="Accessibility needs"
                      value={answer.accessibilityNeeds}
                      onChange={(value) => setAnswer(guest.id, { accessibilityNeeds: value })}
                      placeholder="Step-free access, seating, and so on"
                    />
                  </div>
                ) : null}
              </fieldset>
            </li>
          )
        })}
      </ul>

      <div className="space-y-4">
        <Field
          id="contact-email"
          label="Email (so we can reach you)"
          type="email"
          value={email}
          onChange={setEmail}
        />
        {smsEnabled ? (
          <>
            <Field
              id="contact-phone"
              label="Mobile number (optional)"
              type="tel"
              value={phone}
              onChange={setPhone}
            />
            <div className="flex items-start gap-3">
              <input
                id="sms-consent"
                type="checkbox"
                checked={smsConsent}
                onChange={(event) => setSmsConsent(event.target.checked)}
                aria-describedby="sms-consent-help"
                className="mt-1"
              />
              <div className="text-sm">
                <label htmlFor="sms-consent">
                  Text this number on the day when our photograph is coming up
                </label>
                <p id="sms-consent-help" className="mt-0.5 text-guest-muted">
                  Only for the wedding day itself. Leave it unticked and we will not text you.
                </p>
              </div>
            </div>
          </>
        ) : null}

        <Field
          id="message"
          label="A message for the couple (optional)"
          multiline
          value={message}
          onChange={setMessage}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-guest-accent px-6 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Sending…' : hasResponded ? 'Update our response' : 'Send our response'}
        </button>
        <p className="mt-3 text-center text-sm text-guest-muted" aria-live="polite">
          {answered} of {party.guests.length} {party.guests.length === 1 ? 'person' : 'people'}{' '}
          answered
        </p>
      </div>
    </form>
  )
}

function ChoiceButton({
  name,
  checked,
  onChange,
  tone,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  tone: 'attending' | 'declined'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'attending'
      ? 'border-status-attending bg-status-attending/10 text-status-attending'
      : 'border-status-declined bg-status-declined/10 text-status-declined'

  // A real radio input keeps this keyboard- and screen-reader-operable; the visual
  // button styling is applied to the label (docs/UX.md §7).
  return (
    <label
      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-medium transition ${
        checked ? toneClass : 'border-guest-border text-guest-muted hover:border-guest-ink/30'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
}) {
  const className = 'w-full rounded-xl border border-guest-border bg-guest-bg px-3 py-2 text-base'

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </div>
  )
}
