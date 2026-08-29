'use client'

import { useActionState } from 'react'

import {
  updateWeddingSettings,
  type SettingsState,
} from '@/app/(organiser)/dashboard/settings/actions'
import { FEATURES, type FeatureFlags } from '@/domain/wedding/features'
import { cn } from '@/lib/cn'

type VenueValues = {
  venueName: string
  address: string
  mapUrl: string
  startTime: string
  notes: string
}

export type SettingsValues = {
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string
  timezone: string
  rsvpDeadline: string
  dressCode: string
  welcomeMessage: string
  travelInformation: string
  parkingInformation: string
  accommodationInformation: string
  ceremony: VenueValues
  reception: VenueValues
  features: FeatureFlags
}

const FEATURE_LABELS: Record<string, string> = {
  rsvp: 'RSVP',
  menu: 'Menu & meal choices',
  seating: 'Seating planner',
  itinerary: 'Itinerary',
  photoQueue: 'Wedding-day photo queue',
  accommodation: 'Accommodation',
  travel: 'Travel & parking',
  faqs: 'FAQs',
  contacts: 'Wedding contacts',
  smsNotifications: 'SMS notifications',
}

const initial: SettingsState = {}

export function WeddingSettingsForm({
  settings,
  className,
}: {
  settings: SettingsValues
  className?: string
}) {
  const [state, formAction, pending] = useActionState(updateWeddingSettings, initial)

  return (
    <form action={formAction} className={cn('space-y-8', className)}>
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-status-declined/40 bg-status-declined/5 px-3 py-2 text-sm text-status-declined"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-status-attending/40 bg-status-attending/5 px-3 py-2 text-sm text-status-attending"
        >
          Saved. Your guest website has been updated.
        </p>
      ) : null}

      <Section title="The couple">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="partnerOneName"
            label="First name"
            defaultValue={settings.partnerOneName}
            required
          />
          <Field
            id="partnerTwoName"
            label="Partner’s name"
            defaultValue={settings.partnerTwoName}
            required
          />
        </div>
      </Section>

      <Section title="When">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="weddingDate"
            label="Wedding date and time"
            type="datetime-local"
            defaultValue={settings.weddingDate}
            required
          />
          <Field
            id="timezone"
            label="Timezone"
            defaultValue={settings.timezone}
            hint="IANA name, e.g. Europe/London. Guests abroad see your local time, not theirs."
          />
          <Field
            id="rsvpDeadline"
            label="RSVP deadline"
            type="datetime-local"
            defaultValue={settings.rsvpDeadline}
            hint="After this, guests can no longer change their reply."
          />
          <Field id="dressCode" label="Dress code" defaultValue={settings.dressCode} />
        </div>
      </Section>

      <Section title="Welcome message">
        <Field
          id="welcomeMessage"
          label="Shown on your home page"
          defaultValue={settings.welcomeMessage}
          multiline
          rows={3}
        />
      </Section>

      <VenueFields legend="Ceremony" prefix="ceremony" values={settings.ceremony} />
      <VenueFields legend="Reception" prefix="reception" values={settings.reception} />

      <Section title="Guest information">
        <Field
          id="travelInformation"
          label="Getting there"
          defaultValue={settings.travelInformation}
          multiline
        />
        <Field
          id="parkingInformation"
          label="Parking"
          defaultValue={settings.parkingInformation}
          multiline
        />
        <Field
          id="accommodationInformation"
          label="Where to stay"
          defaultValue={settings.accommodationInformation}
          multiline
        />
      </Section>

      <Section title="Sections and features">
        <p className="text-sm text-organiser-muted">
          Turning something off hides it from your guest website entirely.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <input
                id={`feature-${feature}`}
                type="checkbox"
                name="enabledFeatures"
                value={feature}
                defaultChecked={settings.features[feature]}
              />
              <label htmlFor={`feature-${feature}`}>{FEATURE_LABELS[feature] ?? feature}</label>
            </li>
          ))}
        </ul>
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-organiser-muted">{title}</legend>
      {children}
    </fieldset>
  )
}

function VenueFields({
  legend,
  prefix,
  values,
}: {
  legend: string
  prefix: string
  values: VenueValues
}) {
  return (
    <Section title={legend}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}.venueName`} label="Venue name" defaultValue={values.venueName} />
        <Field
          id={`${prefix}.startTime`}
          label="Start time"
          type="datetime-local"
          defaultValue={values.startTime}
        />
      </div>
      <Field id={`${prefix}.address`} label="Address" defaultValue={values.address} multiline />
      <Field
        id={`${prefix}.mapUrl`}
        label="Map link"
        defaultValue={values.mapUrl}
        hint="A Google Maps or similar link, starting with https://"
      />
      <Field id={`${prefix}.notes`} label="Anything else" defaultValue={values.notes} multiline />
    </Section>
  )
}

function Field({
  id,
  label,
  defaultValue,
  type = 'text',
  multiline = false,
  rows = 2,
  required = false,
  hint,
}: {
  id: string
  label: string
  defaultValue: string
  type?: string
  multiline?: boolean
  rows?: number
  required?: boolean
  hint?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const className =
    'w-full rounded-md border border-organiser-border bg-organiser-surface px-3 py-2 text-sm'

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={id}
          rows={rows}
          defaultValue={defaultValue}
          aria-describedby={hintId}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          defaultValue={defaultValue}
          aria-describedby={hintId}
          className={className}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-organiser-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
