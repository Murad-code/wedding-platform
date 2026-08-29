import { describe, expect, it } from 'vitest'

import {
  coursesForGuest,
  isCourseOfferedTo,
  missingRequiredCourses,
  tallyOptions,
  validateSelections,
  type MenuCourse,
  type MenuOption,
} from '@/domain/menu/menu'

function option(id: number, courseId: number, name = `Option ${id}`): MenuOption {
  return {
    id,
    courseId,
    name,
    description: null,
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    order: id,
  }
}

function course(partial: Partial<MenuCourse> & { id: number }): MenuCourse {
  return {
    name: `Course ${partial.id}`,
    description: null,
    required: true,
    childrenOnly: false,
    order: partial.id,
    options: [option(partial.id * 10, partial.id), option(partial.id * 10 + 1, partial.id)],
    ...partial,
  }
}

const starter = course({ id: 1, name: 'Starter' })
const main = course({ id: 2, name: 'Main' })
const kids = course({ id: 3, name: 'Children’s menu', childrenOnly: true })
const menu = [starter, main, kids]

describe('coursesForGuest', () => {
  it('offers ordinary courses to an adult but not the children’s menu', () => {
    expect(coursesForGuest(menu, 'adult').map((c) => c.id)).toEqual([1, 2])
  })

  it('offers a child everything, including the children’s menu', () => {
    expect(coursesForGuest(menu, 'child').map((c) => c.id)).toEqual([1, 2, 3])
  })

  it('offers an infant nothing — they are not catered for by course', () => {
    expect(coursesForGuest(menu, 'infant')).toEqual([])
  })

  it('skips a course with no options rather than showing an empty choice', () => {
    const empty = course({ id: 4, options: [] })
    expect(coursesForGuest([...menu, empty], 'adult').map((c) => c.id)).toEqual([1, 2])
  })

  it('orders by the order field', () => {
    const later = course({ id: 5, order: 0 })
    expect(coursesForGuest([starter, later], 'adult').map((c) => c.id)).toEqual([5, 1])
  })
})

describe('isCourseOfferedTo', () => {
  it('keeps the children’s menu away from adults', () => {
    expect(isCourseOfferedTo(kids, 'adult')).toBe(false)
    expect(isCourseOfferedTo(kids, 'child')).toBe(true)
  })

  it('offers nothing to infants', () => {
    expect(isCourseOfferedTo(starter, 'infant')).toBe(false)
  })
})

describe('validateSelections', () => {
  it('accepts a valid set of choices', () => {
    expect(
      validateSelections({
        courses: menu,
        ageGroup: 'adult',
        selections: [
          { courseId: 1, optionId: 10 },
          { courseId: 2, optionId: 20 },
        ],
      }),
    ).toEqual([])
  })

  it('rejects an unknown course', () => {
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [{ courseId: 99, optionId: 10 }],
    })
    expect(problems).toEqual([{ kind: 'unknown-course', courseId: 99 }])
  })

  it('rejects an option that belongs to a different course', () => {
    // The tampering case: a valid option id, posted against the wrong course.
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [{ courseId: 1, optionId: 20 }],
    })
    expect(problems).toEqual([{ kind: 'option-wrong-course', courseId: 1, optionId: 20 }])
  })

  it('rejects an option that does not exist at all', () => {
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [{ courseId: 1, optionId: 9999 }],
    })
    expect(problems).toEqual([{ kind: 'unknown-option', courseId: 1, optionId: 9999 }])
  })

  it('stops an adult ordering from the children’s menu', () => {
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [{ courseId: 3, optionId: 30 }],
    })
    expect(problems).toEqual([{ kind: 'course-not-offered', courseId: 3 }])
  })

  it('rejects two choices for the same course', () => {
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [
        { courseId: 1, optionId: 10 },
        { courseId: 1, optionId: 11 },
      ],
    })
    expect(problems).toEqual([{ kind: 'duplicate-course', courseId: 1 }])
  })

  it('ignores missing courses unless completeness is required', () => {
    const selections = [{ courseId: 1, optionId: 10 }]
    expect(validateSelections({ courses: menu, ageGroup: 'adult', selections })).toEqual([])
    expect(
      validateSelections({ courses: menu, ageGroup: 'adult', selections, requireComplete: true }),
    ).toEqual([{ kind: 'missing-required', courseId: 2 }])
  })

  it('does not demand an optional course', () => {
    const optional = course({ id: 6, required: false })
    expect(
      validateSelections({
        courses: [optional],
        ageGroup: 'adult',
        selections: [],
        requireComplete: true,
      }),
    ).toEqual([])
  })

  it('does not demand the children’s menu from an adult', () => {
    const problems = validateSelections({
      courses: menu,
      ageGroup: 'adult',
      selections: [
        { courseId: 1, optionId: 10 },
        { courseId: 2, optionId: 20 },
      ],
      requireComplete: true,
    })
    expect(problems).toEqual([])
  })

  it('demands nothing from an infant', () => {
    expect(
      validateSelections({
        courses: menu,
        ageGroup: 'infant',
        selections: [],
        requireComplete: true,
      }),
    ).toEqual([])
  })
})

describe('missingRequiredCourses', () => {
  it('lists what a guest still owes', () => {
    const missing = missingRequiredCourses(menu, 'adult', [{ courseId: 1, optionId: 10 }])
    expect(missing.map((c) => c.name)).toEqual(['Main'])
  })

  it('is empty once everything required is chosen', () => {
    const missing = missingRequiredCourses(menu, 'adult', [
      { courseId: 1, optionId: 10 },
      { courseId: 2, optionId: 20 },
    ])
    expect(missing).toEqual([])
  })

  it('includes the children’s menu for a child', () => {
    expect(missingRequiredCourses(menu, 'child', []).map((c) => c.id)).toEqual([1, 2, 3])
  })
})

describe('tallyOptions', () => {
  it('counts each option', () => {
    const tally = tallyOptions(menu, [
      { courseId: 1, optionId: 10 },
      { courseId: 1, optionId: 10 },
      { courseId: 2, optionId: 21 },
    ])

    expect(tally.find((t) => t.optionId === 10)?.count).toBe(2)
    expect(tally.find((t) => t.optionId === 21)?.count).toBe(1)
  })

  it('includes options nobody chose', () => {
    // "Nobody chose the salmon" is exactly as useful to a caterer as the counts.
    const tally = tallyOptions(menu, [{ courseId: 1, optionId: 10 }])
    expect(tally.find((t) => t.optionId === 11)?.count).toBe(0)
  })

  it('reports the course each option belongs to', () => {
    const tally = tallyOptions(menu, [])
    expect(tally.find((t) => t.optionId === 20)?.courseName).toBe('Main')
  })

  it('returns an empty tally for an empty menu', () => {
    expect(tallyOptions([], [])).toEqual([])
  })
})
