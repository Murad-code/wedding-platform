import { isChildMenuEligible, type AgeGroup } from '@/domain/guests/guest'

/**
 * Menu modelling.
 *
 * The brief asks for four menu models, and they are all expressible without special
 * cases: a fixed menu is a course with one option, selectable courses are the normal
 * case, "no advance selection" is the `menu` feature turned off, and a children's menu
 * is a course marked `childrenOnly`.
 */

export type MenuOption = {
  id: number
  courseId: number
  name: string
  description: string | null
  isVegetarian: boolean
  isVegan: boolean
  isGlutenFree: boolean
  order: number
}

export type MenuCourse = {
  id: number
  name: string
  description: string | null
  /** A guest must choose from this course before their RSVP counts as complete. */
  required: boolean
  /** Offered only to guests whose age group is `child`. */
  childrenOnly: boolean
  order: number
  options: MenuOption[]
}

/** One guest's choice for one course. */
export type MealSelection = {
  courseId: number
  optionId: number
}

/**
 * The courses a particular guest is asked to choose from.
 *
 * Infants are excluded entirely: they are not catered for by course, and asking their
 * parents to pick a starter for them is noise.
 */
export function coursesForGuest(courses: readonly MenuCourse[], ageGroup: AgeGroup): MenuCourse[] {
  if (ageGroup === 'infant') return []

  return courses
    .filter((course) => (course.childrenOnly ? isChildMenuEligible(ageGroup) : true))
    .filter((course) => course.options.length > 0)
    .sort((a, b) => a.order - b.order || a.id - b.id)
}

/**
 * Adults must not be offered the children's menu, and children should still be offered
 * the ordinary courses unless the couple has said otherwise.
 */
export function isCourseOfferedTo(course: MenuCourse, ageGroup: AgeGroup): boolean {
  if (ageGroup === 'infant') return false
  return course.childrenOnly ? isChildMenuEligible(ageGroup) : true
}

export type SelectionProblem =
  | { kind: 'unknown-course'; courseId: number }
  | { kind: 'unknown-option'; courseId: number; optionId: number }
  | { kind: 'option-wrong-course'; courseId: number; optionId: number }
  | { kind: 'course-not-offered'; courseId: number }
  | { kind: 'duplicate-course'; courseId: number }
  | { kind: 'missing-required'; courseId: number }

/**
 * Validates a guest's choices against the menu.
 *
 * Run on the server for every submission. A guest can post any course and option ids
 * they like, so "this option belongs to this course" and "this course is offered to this
 * guest" are both checked here rather than assumed from the form (docs/SECURITY.md §6).
 */
export function validateSelections({
  courses,
  ageGroup,
  selections,
  requireComplete = false,
}: {
  courses: readonly MenuCourse[]
  ageGroup: AgeGroup
  selections: readonly MealSelection[]
  /** When true, missing required courses are reported as problems. */
  requireComplete?: boolean
}): SelectionProblem[] {
  const problems: SelectionProblem[] = []
  const byId = new Map(courses.map((course) => [course.id, course]))
  const seen = new Set<number>()

  for (const selection of selections) {
    if (seen.has(selection.courseId)) {
      problems.push({ kind: 'duplicate-course', courseId: selection.courseId })
      continue
    }
    seen.add(selection.courseId)

    const course = byId.get(selection.courseId)
    if (!course) {
      problems.push({ kind: 'unknown-course', courseId: selection.courseId })
      continue
    }

    if (!isCourseOfferedTo(course, ageGroup)) {
      problems.push({ kind: 'course-not-offered', courseId: course.id })
      continue
    }

    const option = course.options.find((candidate) => candidate.id === selection.optionId)
    if (!option) {
      // Distinguish "no such option anywhere" from "belongs to a different course", so
      // the failure is diagnosable without leaking the whole menu to the caller.
      const existsElsewhere = courses.some((other) =>
        other.options.some((candidate) => candidate.id === selection.optionId),
      )
      problems.push(
        existsElsewhere
          ? { kind: 'option-wrong-course', courseId: course.id, optionId: selection.optionId }
          : { kind: 'unknown-option', courseId: course.id, optionId: selection.optionId },
      )
    }
  }

  if (requireComplete) {
    for (const course of coursesForGuest(courses, ageGroup)) {
      if (course.required && !seen.has(course.id)) {
        problems.push({ kind: 'missing-required', courseId: course.id })
      }
    }
  }

  return problems
}

/** Courses this guest still needs to choose from. Drives the chase list. */
export function missingRequiredCourses(
  courses: readonly MenuCourse[],
  ageGroup: AgeGroup,
  selections: readonly MealSelection[],
): MenuCourse[] {
  const chosen = new Set(selections.map((selection) => selection.courseId))
  return coursesForGuest(courses, ageGroup).filter(
    (course) => course.required && !chosen.has(course.id),
  )
}

export type OptionTally = {
  optionId: number
  optionName: string
  courseId: number
  courseName: string
  count: number
}

/**
 * Counts how many of each option have been chosen — the number the caterer needs.
 *
 * Options with no takers are included with a count of zero: "nobody chose the salmon" is
 * exactly as useful to a caterer as "eleven chose the beef".
 */
export function tallyOptions(
  courses: readonly MenuCourse[],
  selections: readonly MealSelection[],
): OptionTally[] {
  const counts = new Map<number, number>()
  for (const selection of selections) {
    counts.set(selection.optionId, (counts.get(selection.optionId) ?? 0) + 1)
  }

  return courses
    .slice()
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .flatMap((course) =>
      course.options
        .slice()
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map((option) => ({
          optionId: option.id,
          optionName: option.name,
          courseId: course.id,
          courseName: course.name,
          count: counts.get(option.id) ?? 0,
        })),
    )
}
