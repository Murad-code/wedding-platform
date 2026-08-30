# UX Specification

## 1. Two products, one codebase

|                | Organiser                                              | Guest                                        |
| -------------- | ------------------------------------------------------ | -------------------------------------------- |
| Feels like     | A capable SaaS dashboard                               | A premium wedding website                    |
| Primary device | Desktop / tablet                                       | Phone                                        |
| Optimised for  | Density, fast editing, bulk actions, status visibility | Beauty, calm, minimal interaction, speed     |
| Typography     | UI sans, compact                                       | Editorial serif display + readable sans body |
| Density        | Tight, tabular                                         | Generous whitespace                          |
| Motion         | Minimal, functional                                    | Restrained, tasteful                         |

The guest experience must never look like a CMS. No data tables, no ids, no jargon, no
"records". A guest sees their own names and a question, not a form on a collection.

## 2. Page map

```
GUEST (public, mobile-first)
  /                         Landing — hero, couple, date, countdown, section nav
  /our-day                  Ceremony, reception, itinerary
  /venue                    Venue, map, travel, parking, accommodation
  /menu                     Menu (when enabled)
  /faqs                     FAQs
  /contact                  Visible wedding contacts
  /rsvp                     Explains that a personal link is needed
  /invite/[token]           Personalised invitation + RSVP        [token-gated]
  /invite/[token]/confirmed Confirmation, editable until deadline [token-gated]
  /photos                   Wedding-day live photo queue          [feature-flagged]
  /photos/[token]           The same queue, plus your own groups  [token-gated]

ORGANISER (authenticated)
  /login
  /dashboard                Overview, stats, alerts, next actions
  /dashboard/guests         Guest list — search, filter, sort, bulk, CSV
  /dashboard/guests/[id]
  /dashboard/parties        Invitation parties
  /dashboard/parties/[id]   Party detail + invitation link + rotate
  /dashboard/rsvps          RSVP tracking, dietary alerts, chase list
  /dashboard/menu           Courses, options, selection report
  /dashboard/seating        Visual seating planner
  /dashboard/itinerary      Timeline editor
  /dashboard/photos         Photo groups
  /dashboard/photos/run     Wedding-day controller
  /dashboard/website        Content and section visibility
  /dashboard/settings       Wedding settings
  /dashboard/team           Organiser users                       [admin only]

PLATFORM
  /admin                    Payload Admin                         [admin only]
  /api/health
```

## 3. Organiser journeys

### 3.1 First run

A new deployment has nothing in it. The first screen must not be an empty table.

`/dashboard` detects an unconfigured wedding and shows a setup checklist:
`Wedding details → First guests → Invitation → Website → Menu → Seating`,
each with a one-line "why this matters" and a direct action. The checklist stays available
but recedes once complete.

### 3.2 Guest list

Dense table: name, party, RSVP status, meal, dietary flag, table, tags.
Persistent search; filter chips (attending / declined / awaiting / dietary /
missing meal / unassigned / table / party / tag) reflected in the URL so a filtered view
is shareable and survives a refresh. Multi-select enables bulk tag, bulk table, delete.
Inline editing for the fields organisers change most (name, status).

Dietary requirements and allergies show as an alert affordance, never buried in a
detail pane — a missed allergy is the highest-consequence failure in this product.

### 3.3 Seating planner

Two panes: unassigned guests on the left, tables as cards on the right. Each table shows
occupancy `6/8`; over capacity turns amber with a warning, but **is not blocked** —
organisers legitimately add a chair.

Drag and drop via dnd-kit. **A keyboard path is mandatory, not a fallback**: every guest
row has an "Assign to table" control reachable by keyboard, and dnd-kit's keyboard sensor
is enabled with live-region announcements. Drag-only seating would exclude both keyboard
and screen-reader users, and is also simply hard on a touchscreen.

### 3.4 Wedding-day controller

Designed for a phone held in one hand, outdoors, possibly in sunlight.
Large current-group card, the member list, and four large touch targets:
`Previous · Call Next · Complete · Skip`. High contrast, no small text, destructive-ish
actions (Skip) visually distinct. Shows connection status honestly.

## 4. Guest journeys

### 4.1 Invitation

Opening the link should feel personal and immediate:

1. Hero with the couple's names and the date.
2. "Murad, Priya and family — you're invited."
3. The essentials: when, where, dress code.
4. RSVP, one guest at a time — a clear Attending / Can't make it choice per person.
5. Conditional follow-ups only for attending guests: meal, dietary, accessibility.
6. Optional message to the couple.
7. Confirmation with a summary and "you can change this until <deadline>".

Principles: never show a guest another party's data; never show empty scaffolding for
disabled features; never require typing where a tap will do; keep the whole flow to one
scrolling page on a phone, with progress that is obvious.

### 4.2 Wedding-day photo queue

A single mobile screen, glanceable from a distance:

```
        NOW
   Bride's Immediate Family

      UP NEXT
   Groom's Immediate Family

    YOUR GROUP
   University Friends
   You are 3 groups away
```

Emphasis shifts as the guest's group approaches: distant is calm and grey; "next" is
prominent with a "start making your way over" nudge; "now" is unmistakable. A guest in no
group sees NOW and UP NEXT without a personal section rather than an empty box.

Connection state is shown plainly ("Live" / "Reconnecting…"), because a frozen screen at
a wedding is worse than an honest one.

## 5. UI states

Every data-driven view specifies four states — this is a review requirement, not advice:

- **Loading** — skeletons matching final layout, no spinner-only screens, no layout shift.
- **Empty** — explains what the thing is and offers the action that creates the first one.
- **Error** — plain language, what happened, what to do, a retry. Never a raw stack trace.
- **Populated** — the normal case.

Additional states that must be handled: partially complete (some guests responded),
over capacity, past deadline, feature disabled, and offline/reconnecting.

## 6. Responsive

| Breakpoint | Guest                                            | Organiser                                                    |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------ |
| < 640      | Primary target; single column; large tap targets | Usable: stacked cards instead of tables; core actions only   |
| 640–1024   | Comfortable                                      | Good; planner becomes single-column with explicit assignment |
| > 1024     | Generous editorial layout                        | Primary target; full density and drag/drop                   |

Guest wedding-day screens are designed phone-first and tested at 375×667 upward.
Tap targets ≥ 44px. No hover-only affordances anywhere in the guest experience.

## 7. Accessibility

Target: WCAG 2.2 AA.

- Semantic HTML: real `<button>`, real `<form>`, correct heading order, landmarks.
- Every input has a programmatically associated label; errors linked via
  `aria-describedby` and announced.
- Visible focus indicators everywhere; never `outline: none` without a replacement.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI boundaries. Wedding palettes
  drift pale — contrast is checked, not assumed.
- Status is never conveyed by colour alone: attending/declined carry an icon and text.
- Live regions for the photo queue and drag-and-drop announcements.
- Keyboard-operable seating (see 3.3) and a `prefers-reduced-motion` path for countdown
  and transition animations.

## 8. Content and tone

Organiser: clear and functional. "3 guests haven't chosen a meal."
Guest: warm and human. "We'd love to know if you can make it."
Never expose internal vocabulary — no "records", "collections", "entities", or ids.
Dates render in the wedding's configured timezone, never the viewer's, so a guest abroad
sees the ceremony time the couple actually meant.
