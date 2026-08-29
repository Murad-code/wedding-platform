import config from '@payload-config'
import { getPayload } from 'payload'

import { toCsv } from '@/domain/guests/csv'
import { guestDisplayName, type AgeGroup } from '@/domain/guests/guest'
import {
  missingRequiredCourses,
  tallyOptions,
  type MealSelection,
  type MenuCourse,
  type OptionTally,
} from '@/domain/menu/menu'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/** Payload returns a relationship as an id or a populated document, depending on depth. */
function relationId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/** The full menu, courses with their options, ordered. */
export async function getMenu(): Promise<MenuCourse[]> {
  const payload = await getPayload({ config })

  const [courses, options] = await Promise.all([
    payload.find({
      collection: 'menu-courses',
      limit: 50,
      sort: 'order',
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'menu-options',
      limit: 500,
      sort: 'order',
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return courses.docs.map((course) => ({
    id: course.id,
    name: course.name,
    description: text(course.description),
    required: course.required === true,
    childrenOnly: course.childrenOnly === true,
    order: course.order ?? 0,
    options: options.docs
      .filter((option) => relationId(option.course) === course.id)
      .map((option) => ({
        id: option.id,
        courseId: course.id,
        name: option.name,
        description: text(option.description),
        isVegetarian: option.isVegetarian === true,
        isVegan: option.isVegan === true,
        isGlutenFree: option.isGlutenFree === true,
        order: option.order ?? 0,
      })),
  }))
}

/** One guest's current choices. */
export async function getSelectionsForGuests(
  guestIds: readonly number[],
): Promise<Map<number, MealSelection[]>> {
  const byGuest = new Map<number, MealSelection[]>()
  if (guestIds.length === 0) return byGuest

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'guest-meal-selections',
    where: { guest: { in: [...guestIds] } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })

  for (const row of result.docs) {
    const guestId = relationId(row.guest)
    const courseId = relationId(row.course)
    const optionId = relationId(row.option)
    if (guestId === null || courseId === null || optionId === null) continue

    const list = byGuest.get(guestId) ?? []
    list.push({ courseId, optionId })
    byGuest.set(guestId, list)
  }

  return byGuest
}

/**
 * Replaces a guest's choices, inside a transaction.
 *
 * Delete-then-insert rather than upsert: it is the only way to express "these are now
 * the choices", including removing a course the guest has backed out of. The unique
 * index on (guest, course) still guarantees the result is coherent if two writers race.
 */
export async function replaceSelections(
  guestId: number,
  selections: readonly MealSelection[],
  transactionID?: string | number,
): Promise<void> {
  const payload = await getPayload({ config })
  const req = transactionID
    ? ({ transactionID } as Parameters<typeof payload.create>[0]['req'])
    : undefined

  await payload.delete({
    collection: 'guest-meal-selections',
    where: { guest: { equals: guestId } },
    overrideAccess: true,
    req,
  })

  for (const selection of selections) {
    await payload.create({
      collection: 'guest-meal-selections',
      overrideAccess: true,
      req,
      data: { guest: guestId, course: selection.courseId, option: selection.optionId },
    })
  }
}

export type CateringGuest = {
  guestId: number
  name: string
  partyName: string
  ageGroup: AgeGroup
  choices: { courseName: string; optionName: string }[]
  missingCourses: string[]
  dietaryRequirements: string | null
  allergies: string | null
}

export type CateringReport = {
  attending: number
  adults: number
  children: number
  infants: number
  tallies: OptionTally[]
  guestsMissingChoices: CateringGuest[]
  guestsWithDietaryNeeds: CateringGuest[]
  allGuests: CateringGuest[]
}

/**
 * Everything the caterer and the couple need, from one pass over the attending guests.
 *
 * Only attending guests are counted: nobody cooks for a decline.
 */
export async function getCateringReport(): Promise<CateringReport> {
  const payload = await getPayload({ config })
  const menu = await getMenu()

  const guests = await payload.find({
    collection: 'guests',
    where: { rsvpStatus: { equals: 'attending' } },
    limit: 2000,
    depth: 1,
    sort: 'lastName',
    overrideAccess: true,
  })

  const selectionsByGuest = await getSelectionsForGuests(guests.docs.map((guest) => guest.id))
  const courseNames = new Map(menu.map((course) => [course.id, course.name]))
  const optionNames = new Map(
    menu.flatMap((course) => course.options.map((option) => [option.id, option.name] as const)),
  )

  const allGuests: CateringGuest[] = guests.docs.map((guest) => {
    const ageGroup = (guest.ageGroup ?? 'adult') as AgeGroup
    const selections = selectionsByGuest.get(guest.id) ?? []

    return {
      guestId: guest.id,
      name: guestDisplayName(guest.firstName, text(guest.lastName)),
      partyName:
        guest.party && typeof guest.party === 'object' ? (guest.party.displayName ?? '') : '',
      ageGroup,
      choices: selections.map((selection) => ({
        courseName: courseNames.get(selection.courseId) ?? 'Unknown course',
        optionName: optionNames.get(selection.optionId) ?? 'Unknown option',
      })),
      missingCourses: missingRequiredCourses(menu, ageGroup, selections).map(
        (course) => course.name,
      ),
      dietaryRequirements: text(guest.dietaryRequirements),
      allergies: text(guest.allergies),
    }
  })

  const allSelections = [...selectionsByGuest.values()].flat()

  return {
    attending: allGuests.length,
    adults: allGuests.filter((guest) => guest.ageGroup === 'adult').length,
    children: allGuests.filter((guest) => guest.ageGroup === 'child').length,
    infants: allGuests.filter((guest) => guest.ageGroup === 'infant').length,
    tallies: tallyOptions(menu, allSelections),
    guestsMissingChoices: allGuests.filter((guest) => guest.missingCourses.length > 0),
    guestsWithDietaryNeeds: allGuests.filter(
      (guest) => guest.dietaryRequirements || guest.allergies,
    ),
    allGuests,
  }
}

/**
 * The caterer's CSV.
 *
 * One row per attending guest with their choices spelled out, because a caterer plates
 * per person and cannot work from totals alone. Allergies come first among the free-text
 * columns — it is the field with the most serious consequence if missed.
 */
export function cateringCsv(report: CateringReport, courses: readonly MenuCourse[]): string {
  const courseColumns = courses.map((course) => course.name)
  const columns = ['name', 'party', 'ageGroup', ...courseColumns, 'allergies', 'dietary', 'missing']

  const rows = report.allGuests.map((guest) => {
    const row: Record<string, string | null> = {
      name: guest.name,
      party: guest.partyName,
      ageGroup: guest.ageGroup,
      allergies: guest.allergies,
      dietary: guest.dietaryRequirements,
      missing: guest.missingCourses.join('; ') || null,
    }

    for (const courseName of courseColumns) {
      row[courseName] = guest.choices.find((c) => c.courseName === courseName)?.optionName ?? null
    }

    return row
  })

  return toCsv(rows, columns)
}
