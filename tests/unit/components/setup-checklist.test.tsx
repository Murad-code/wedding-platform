import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SetupChecklist } from '@/components/organiser/setup-checklist'

/**
 * Tested here rather than end-to-end because WeddingSettings is a per-deployment
 * singleton (ADR-001): an E2E test asserting "unconfigured" would depend on global
 * state that any other test could change.
 */
describe('SetupChecklist', () => {
  it('explains what to do first rather than showing an empty table', () => {
    render(<SetupChecklist />)

    expect(screen.getByRole('heading', { name: /set up your wedding/i })).toBeInTheDocument()
  })

  it('offers the three onboarding steps in order', () => {
    render(<SetupChecklist />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(/wedding details/i)
    expect(items[1]).toHaveTextContent(/guest list/i)
    expect(items[2]).toHaveTextContent(/invitations/i)
  })

  it('gives each step a reason, not just a label', () => {
    render(<SetupChecklist />)

    // Onboarding that says only "add guests" does not tell a nervous couple why.
    expect(screen.getByText(/drive the whole guest website/i)).toBeInTheDocument()
    expect(screen.getByText(/households respond together/i)).toBeInTheDocument()
  })

  it('links each step to where the work happens', () => {
    render(<SetupChecklist />)

    expect(screen.getByRole('link', { name: 'Add details' })).toHaveAttribute(
      'href',
      '/dashboard/settings',
    )
    expect(screen.getByRole('link', { name: 'Add guests' })).toHaveAttribute(
      'href',
      '/dashboard/guests',
    )
  })

  it('reassures that one party’s invitation is private to them', () => {
    render(<SetupChecklist />)
    expect(screen.getByText(/no guest can see another party/i)).toBeInTheDocument()
  })
})
