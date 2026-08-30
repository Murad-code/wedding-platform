import { AGE_GROUPS, type AgeGroup, isAgeGroup } from './guest'
import { isRsvpStatus, type RsvpStatus } from '@/domain/rsvp/status'

/**
 * CSV import and export for the guest list.
 *
 * Organisers arrive with a spreadsheet, and it will not be clean: smart quotes, trailing
 * blank rows, a UTF-8 BOM from Excel, commas inside names, and CRLF line endings are all
 * normal. Parsing is therefore hand-rolled and strict about structure but forgiving about
 * formatting, and it reports errors per row so a single bad line does not reject an
 * otherwise good file.
 */

export const CSV_COLUMNS = [
  'party',
  'firstName',
  'lastName',
  'ageGroup',
  'email',
  'phone',
  'rsvpStatus',
  'dietaryRequirements',
  'allergies',
  'accessibilityNeeds',
  'notes',
] as const

export type CsvColumn = (typeof CSV_COLUMNS)[number]

/** Columns a file must contain for the import to be meaningful. */
const REQUIRED_COLUMNS = ['party', 'firstName'] as const

export type GuestCsvRow = {
  party: string
  firstName: string
  lastName: string | null
  ageGroup: AgeGroup
  email: string | null
  phone: string | null
  rsvpStatus: RsvpStatus
  dietaryRequirements: string | null
  allergies: string | null
  accessibilityNeeds: string | null
  notes: string | null
}

export type CsvRowError = {
  /** 1-based line number as the organiser sees it in their spreadsheet. */
  line: number
  message: string
}

export type ParsedGuestCsv = {
  rows: GuestCsvRow[]
  errors: CsvRowError[]
  /** Rows that duplicate an earlier row in the same file. */
  duplicates: CsvRowError[]
}

const MAX_FIELD_LENGTH = 500
const MAX_ROWS = 2000

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Splits CSV text into rows of fields.
 *
 * Written out rather than using `split(',')`, which corrupts any quoted field containing
 * a comma — "Kamali, Murad" being exactly the kind of value a real guest list holds.
 * Handles quoted fields, escaped quotes (`""`), embedded newlines, CRLF, and a BOM.
 */
export function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const rows: string[][] = []

  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0

  const endField = () => {
    row.push(field)
    field = ''
  }

  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (index < text.length) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }

    if (char === ',') {
      endField()
      index += 1
      continue
    }

    if (char === '\r') {
      // Treat CRLF and a lone CR as one line break.
      if (text[index + 1] === '\n') index += 1
      endRow()
      index += 1
      continue
    }

    if (char === '\n') {
      endRow()
      index += 1
      continue
    }

    field += char
    index += 1
  }

  // A trailing newline should not produce a phantom final row.
  if (field.length > 0 || row.length > 0) endRow()

  return rows
}

function normaliseHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

/** Maps a spreadsheet's header row onto our columns, tolerating case and spacing. */
function mapHeaders(header: string[]): Map<CsvColumn, number> {
  const lookup = new Map<string, CsvColumn>(
    CSV_COLUMNS.map((column) => [normaliseHeader(column), column]),
  )
  // Common alternatives an organiser might type.
  lookup.set('group', 'party')
  lookup.set('invitationparty', 'party')
  lookup.set('household', 'party')
  lookup.set('name', 'firstName')
  lookup.set('surname', 'lastName')
  lookup.set('emailaddress', 'email')
  lookup.set('phonenumber', 'phone')
  lookup.set('dietary', 'dietaryRequirements')
  lookup.set('rsvp', 'rsvpStatus')

  const mapped = new Map<CsvColumn, number>()
  header.forEach((raw, position) => {
    const column = lookup.get(normaliseHeader(raw))
    // First occurrence wins, so a duplicated header column does not silently shadow.
    if (column && !mapped.has(column)) mapped.set(column, position)
  })
  return mapped
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return ''
  return (row[index] ?? '').trim()
}

function optional(value: string): string | null {
  return value.length > 0 ? value.slice(0, MAX_FIELD_LENGTH) : null
}

/** A guest is identified for duplicate purposes by their party and full name. */
function identity(row: GuestCsvRow): string {
  return `${row.party.toLowerCase()}::${row.firstName.toLowerCase()}::${(
    row.lastName ?? ''
  ).toLowerCase()}`
}

export function parseGuestCsv(input: string): ParsedGuestCsv {
  const raw = parseCsvRows(input)
  const errors: CsvRowError[] = []
  const duplicates: CsvRowError[] = []
  const rows: GuestCsvRow[] = []

  const header = raw[0]
  if (!header || header.every((value) => value.trim() === '')) {
    return { rows, errors: [{ line: 1, message: 'The file is empty.' }], duplicates }
  }

  const headers = mapHeaders(header)
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.has(column))
  if (missing.length > 0) {
    return {
      rows,
      errors: [
        {
          line: 1,
          message: `Missing required ${missing.length === 1 ? 'column' : 'columns'}: ${missing.join(', ')}.`,
        },
      ],
      duplicates,
    }
  }

  const seen = new Set<string>()

  for (let index = 1; index < raw.length; index++) {
    const line = index + 1
    const record = raw[index]
    if (!record) continue

    // Blank lines are normal at the end of an exported spreadsheet; skip silently.
    if (record.every((value) => value.trim() === '')) continue

    if (rows.length >= MAX_ROWS) {
      errors.push({ line, message: `Import is limited to ${MAX_ROWS} rows.` })
      break
    }

    const party = cell(record, headers.get('party'))
    const firstName = cell(record, headers.get('firstName'))

    if (!party) {
      errors.push({ line, message: 'Missing party. Every guest must belong to a group.' })
      continue
    }
    if (!firstName) {
      errors.push({ line, message: 'Missing first name.' })
      continue
    }

    const ageGroupRaw = cell(record, headers.get('ageGroup')).toLowerCase()
    if (ageGroupRaw && !isAgeGroup(ageGroupRaw)) {
      errors.push({
        line,
        message: `Unknown age group “${ageGroupRaw}”. Use one of: ${AGE_GROUPS.join(', ')}.`,
      })
      continue
    }

    const rsvpRaw = cell(record, headers.get('rsvpStatus')).toLowerCase()
    if (rsvpRaw && !isRsvpStatus(rsvpRaw)) {
      errors.push({
        line,
        message: `Unknown RSVP status “${rsvpRaw}”. Use pending, attending, or declined.`,
      })
      continue
    }

    const email = optional(cell(record, headers.get('email')))
    if (email && !email.includes('@')) {
      errors.push({ line, message: `“${email}” does not look like an email address.` })
      continue
    }

    const row: GuestCsvRow = {
      party: party.slice(0, 200),
      firstName: firstName.slice(0, 100),
      lastName: optional(cell(record, headers.get('lastName')))?.slice(0, 100) ?? null,
      ageGroup: isAgeGroup(ageGroupRaw) ? ageGroupRaw : 'adult',
      email,
      phone: optional(cell(record, headers.get('phone'))),
      rsvpStatus: isRsvpStatus(rsvpRaw) ? rsvpRaw : 'pending',
      dietaryRequirements: optional(cell(record, headers.get('dietaryRequirements'))),
      allergies: optional(cell(record, headers.get('allergies'))),
      accessibilityNeeds: optional(cell(record, headers.get('accessibilityNeeds'))),
      notes: optional(cell(record, headers.get('notes'))),
    }

    const key = identity(row)
    if (seen.has(key)) {
      // Reported separately from errors: a duplicate is usually a copy-paste slip the
      // organiser wants to know about, not a reason to reject the file.
      duplicates.push({ line, message: `${row.firstName} appears more than once in ${row.party}.` })
      continue
    }
    seen.add(key)
    rows.push(row)
  }

  return { rows, errors, duplicates }
}

/* -------------------------------------------------------------------------- */
/* Serialising                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Escapes a single CSV field.
 *
 * A leading `=`, `+`, `-`, or `@` is prefixed with a quote: spreadsheet software would
 * otherwise treat the value as a formula, which is both a corrupted guest name and a
 * well-known CSV injection vector.
 */
export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''

  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value

  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

export function toCsv(
  rows: readonly Record<string, string | null | undefined>[],
  columns: readonly string[] = CSV_COLUMNS,
): string {
  const header = columns.map(escapeCsvField).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCsvField(row[column])).join(','))
  // CRLF is what Excel expects.
  return [header, ...body].join('\r\n')
}
