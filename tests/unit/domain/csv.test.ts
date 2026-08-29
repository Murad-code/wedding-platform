import { describe, expect, it } from 'vitest'

import { escapeCsvField, parseCsvRows, parseGuestCsv, toCsv } from '@/domain/guests/csv'

const HEADER = 'party,firstName,lastName,ageGroup,email'

describe('parseCsvRows', () => {
  it('splits a simple file', () => {
    expect(parseCsvRows('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps commas inside quoted fields', () => {
    // The case a naive split(',') corrupts, and real guest lists contain.
    expect(parseCsvRows('name,note\n"Kamali, Murad",vip')).toEqual([
      ['name', 'note'],
      ['Kamali, Murad', 'vip'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsvRows('name\n"She said ""hello"""')).toEqual([['name'], ['She said "hello"']])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsvRows('address\n"Line 1\nLine 2"')).toEqual([['address'], ['Line 1\nLine 2']])
  })

  it('handles CRLF and lone CR line endings', () => {
    expect(parseCsvRows('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsvRows('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a UTF-8 BOM, which Excel adds', () => {
    expect(parseCsvRows('﻿party,firstName')).toEqual([['party', 'firstName']])
  })

  it('does not invent a row for a trailing newline', () => {
    expect(parseCsvRows('a\n1\n')).toEqual([['a'], ['1']])
  })

  it('preserves empty fields', () => {
    expect(parseCsvRows('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })
})

describe('parseGuestCsv', () => {
  it('parses a well-formed file', () => {
    const { rows, errors } = parseGuestCsv(
      `${HEADER}\nThe Kamali Family,Murad,Kamali,adult,murad@example.com`,
    )

    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      party: 'The Kamali Family',
      firstName: 'Murad',
      lastName: 'Kamali',
      ageGroup: 'adult',
      email: 'murad@example.com',
      rsvpStatus: 'pending',
    })
  })

  it('reports an empty file', () => {
    expect(parseGuestCsv('').errors[0]?.message).toMatch(/empty/i)
  })

  it('reports missing required columns rather than importing nothing silently', () => {
    const { errors, rows } = parseGuestCsv('firstName,lastName\nMurad,Kamali')
    expect(rows).toHaveLength(0)
    expect(errors[0]?.message).toMatch(/party/i)
  })

  it('accepts header variations an organiser might actually type', () => {
    const { rows, errors } = parseGuestCsv('Household,First Name,Surname\nSmiths,John,Smith')
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ party: 'Smiths', firstName: 'John', lastName: 'Smith' })
  })

  it('is case- and spacing-insensitive about headers', () => {
    const { rows } = parseGuestCsv('  PARTY ,  firstname\nSmiths,John')
    expect(rows[0]).toMatchObject({ party: 'Smiths', firstName: 'John' })
  })

  it('skips blank rows left at the end of a spreadsheet', () => {
    const { rows, errors } = parseGuestCsv(`${HEADER}\nSmiths,John,,,\n\n,,,,\n`)
    expect(rows).toHaveLength(1)
    expect(errors).toEqual([])
  })

  it('reports the line number an organiser sees in their spreadsheet', () => {
    const { errors } = parseGuestCsv(`${HEADER}\nSmiths,John,,,\n,Missing,,,`)
    expect(errors[0]?.line).toBe(3)
  })

  it('rejects a row with no party but keeps the good rows', () => {
    const { rows, errors } = parseGuestCsv(`${HEADER}\n,Orphan,,,\nSmiths,John,,,`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.firstName).toBe('John')
    expect(errors[0]?.message).toMatch(/missing party/i)
  })

  it('rejects a row with no first name', () => {
    const { errors } = parseGuestCsv(`${HEADER}\nSmiths,,Smith,,`)
    expect(errors[0]?.message).toMatch(/first name/i)
  })

  it('rejects an unknown age group and names the valid ones', () => {
    const { errors, rows } = parseGuestCsv(`${HEADER}\nSmiths,John,,teenager,`)
    expect(rows).toHaveLength(0)
    expect(errors[0]?.message).toMatch(/adult, child, infant/)
  })

  it('rejects an unknown RSVP status', () => {
    const { errors } = parseGuestCsv(`party,firstName,rsvpStatus\nSmiths,John,maybe`)
    expect(errors[0]?.message).toMatch(/pending, attending, or declined/i)
  })

  it('accepts a valid RSVP status and age group in any case', () => {
    const { rows, errors } = parseGuestCsv(
      `party,firstName,rsvpStatus,ageGroup\nSmiths,John,ATTENDING,Child`,
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ rsvpStatus: 'attending', ageGroup: 'child' })
  })

  it('rejects something that is not an email address', () => {
    const { errors } = parseGuestCsv(`${HEADER}\nSmiths,John,,,not-an-email`)
    expect(errors[0]?.message).toMatch(/email/i)
  })

  it('defaults age group and RSVP status when the columns are absent', () => {
    const { rows } = parseGuestCsv('party,firstName\nSmiths,John')
    expect(rows[0]).toMatchObject({ ageGroup: 'adult', rsvpStatus: 'pending' })
  })

  it('reports duplicates separately from errors, and imports the first occurrence', () => {
    const { rows, duplicates, errors } = parseGuestCsv(
      `${HEADER}\nSmiths,John,Smith,,\nSmiths,John,Smith,,`,
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]?.line).toBe(3)
  })

  it('treats the same name in a different party as a different person', () => {
    const { rows, duplicates } = parseGuestCsv(`${HEADER}\nSmiths,John,Smith,,\nJones,John,Smith,,`)
    expect(rows).toHaveLength(2)
    expect(duplicates).toEqual([])
  })

  it('matches duplicates case-insensitively', () => {
    const { duplicates } = parseGuestCsv(`${HEADER}\nSmiths,John,Smith,,\nsmiths,JOHN,smith,,`)
    expect(duplicates).toHaveLength(1)
  })

  it('handles quoted names containing commas', () => {
    const { rows, errors } = parseGuestCsv(`${HEADER}\n"Smith, John and family",John,Smith,,`)
    expect(errors).toEqual([])
    expect(rows[0]?.party).toBe('Smith, John and family')
  })

  it('caps runaway field lengths rather than storing them', () => {
    const { rows } = parseGuestCsv(
      `party,firstName,dietaryRequirements\nSmiths,John,${'x'.repeat(2000)}`,
    )
    expect(rows[0]?.dietaryRequirements?.length).toBe(500)
  })
})

describe('escapeCsvField', () => {
  it('leaves ordinary values alone', () => {
    expect(escapeCsvField('Murad')).toBe('Murad')
  })

  it('renders null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(escapeCsvField('Kamali, Murad')).toBe('"Kamali, Murad"')
    expect(escapeCsvField('She said "hi"')).toBe('"She said ""hi"""')
    expect(escapeCsvField('one\ntwo')).toBe('"one\ntwo"')
  })

  it('neutralises spreadsheet formulas', () => {
    // Without this, opening the export runs the cell as a formula — corrupting the data
    // and providing a well-known CSV injection vector.
    expect(escapeCsvField('=1+1')).toBe("'=1+1")
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escapeCsvField('+1234')).toBe("'+1234")
    expect(escapeCsvField('-1234')).toBe("'-1234")
  })
})

describe('toCsv', () => {
  it('writes a header and CRLF-separated rows', () => {
    const csv = toCsv([{ party: 'Smiths', firstName: 'John' }], ['party', 'firstName'])
    expect(csv).toBe('party,firstName\r\nSmiths,John')
  })

  it('writes only a header when there are no rows', () => {
    expect(toCsv([], ['party'])).toBe('party')
  })

  it('round-trips through the parser', () => {
    const original = [
      {
        party: 'Smith, John and family',
        firstName: 'John',
        lastName: 'Smith',
        ageGroup: 'adult',
        email: 'john@example.com',
        phone: null,
        rsvpStatus: 'attending',
        dietaryRequirements: 'Vegetarian, no nuts',
        allergies: null,
        accessibilityNeeds: null,
        notes: 'Said "yes" immediately',
      },
    ]

    const { rows, errors } = parseGuestCsv(toCsv(original))

    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      party: 'Smith, John and family',
      dietaryRequirements: 'Vegetarian, no nuts',
      notes: 'Said "yes" immediately',
      rsvpStatus: 'attending',
    })
  })
})
