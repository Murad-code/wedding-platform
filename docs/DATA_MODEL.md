# Data Model

Source of truth is the Payload collection configuration in `src/collections/`. This
document explains intent, relationships, and the constraints that matter. Update it when
collections change.

Conventions: Payload owns `id`, `createdAt`, `updatedAt` on every collection. Payload's
Postgres adapter stores `hasMany` relationships and array fields in generated join
tables; those are noted where they matter for querying.

There is no `weddingId` anywhere. One deployment serves one wedding (ADR-001).

---

## ER diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string name
        enum   role "admin|organiser|viewer"
    }

    INVITATION_PARTIES {
        uuid   id PK
        string displayName
        string tokenHash UK "sha256(token)"
        int    tokenVersion
        enum   status "pending|partial|complete"
        int    plusOnesAllowed
        string contactEmail
        string contactPhone
        text   messageToCouple
        text   internalNotes
        date   respondedAt
        date   invitedAt
    }

    GUESTS {
        uuid   id PK
        uuid   party FK
        uuid   table FK "nullable"
        string firstName
        string lastName
        enum   ageGroup "adult|child|infant"
        enum   rsvpStatus "pending|attending|declined"
        bool   isPlusOne
        string email
        string phone
        text   dietaryRequirements
        text   allergies
        text   accessibilityNeeds
        text   internalNotes
        int    seatOrder
    }

    TAGS {
        uuid   id PK
        string name UK
        string colour
    }

    MENU_COURSES {
        uuid   id PK
        string name
        int    order
        bool   childrenOnly
        bool   required
    }

    MENU_OPTIONS {
        uuid   id PK
        uuid   course FK
        string name
        text   description
        bool   isVegetarian
        bool   isVegan
        bool   isGlutenFree
        int    order
    }

    GUEST_MEAL_SELECTIONS {
        uuid   id PK
        uuid   guest FK
        uuid   course FK
        uuid   option FK
    }

    TABLES {
        uuid   id PK
        string name UK
        int    capacity
        enum   shape "round|rectangle|head"
        int    positionX
        int    positionY
        text   notes
    }

    ITINERARY_ITEMS {
        uuid   id PK
        string title
        text   description
        time   startTime
        time   endTime
        string location
        enum   visibility "public|guests|internal"
        int    order
    }

    PHOTO_GROUPS {
        uuid   id PK
        string name
        text   description
        int    order
        int    estimatedMinutes
        enum   status "queued|get_ready|now|completed|skipped"
        date   calledAt
        date   completedAt
    }

    PHOTO_GROUP_MEMBERS {
        uuid id PK
        uuid photoGroup FK
        uuid guest FK
    }

    WEDDING_CONTACTS {
        uuid   id PK
        string name
        string role
        string phone
        string whatsapp
        string email
        bool   visibleToGuests
        int    order
    }

    NOTIFICATIONS {
        uuid   id PK
        uuid   guest FK
        string dedupeKey UK
        enum   channel "email|sms"
        string type
        string provider
        enum   status "queued|sending|sent|failed"
        string providerMessageId
        int    attempts
        date   lastAttemptAt
        text   error
    }

    AUDIT_EVENTS {
        uuid   id PK
        uuid   actorUser FK "nullable"
        enum   actorType "user|guest|system"
        string action
        string entityType
        string entityId
        json   metadata
        string ipHash
    }

    MEDIA {
        uuid   id PK
        string filename
        string alt
        int    filesize
        string mimeType
    }

    INVITATION_PARTIES ||--|{ GUESTS                : "invites"
    TABLES             ||--o{ GUESTS                : "seats"
    GUESTS             }o--o{ TAGS                  : "tagged"
    MENU_COURSES       ||--|{ MENU_OPTIONS          : "offers"
    GUESTS             ||--o{ GUEST_MEAL_SELECTIONS : "chooses"
    MENU_COURSES       ||--o{ GUEST_MEAL_SELECTIONS : "for"
    MENU_OPTIONS       ||--o{ GUEST_MEAL_SELECTIONS : "picked"
    PHOTO_GROUPS       ||--o{ PHOTO_GROUP_MEMBERS   : "includes"
    GUESTS             ||--o{ PHOTO_GROUP_MEMBERS   : "appears in"
    GUESTS             ||--o{ NOTIFICATIONS         : "receives"
    USERS              ||--o{ AUDIT_EVENTS          : "performs"
```

Globals (single-row, not shown above): `WeddingSettings`, `PhotoQueueState`.

---

## Entities

### Users

Payload auth collection. Organiser accounts only — guests never have accounts.

`role` is `admin | organiser | viewer`.

- `admin` — full access, including Payload Admin at `/admin`.
- `organiser` — full access to the organiser dashboard; no Payload Admin.
- `viewer` — read-only. Intended for a wedding planner or family helper.

Access control is enforced server-side in every collection's `access` functions, not in
the UI (see `docs/SECURITY.md`).

### WeddingSettings (Global)

The single configuration record. Couple names, wedding date and timezone, ceremony and
reception details, venues and map links, RSVP deadline, dress code, welcome text,
accommodation, travel, parking, FAQs, hero imagery, theme, and the feature flags.

**Read exclusively through `getWeddingSettings()`** (ADR-001). No component imports this
global directly.

### InvitationParties

People invited together. The unit that receives an invitation link and submits an RSVP.

- `tokenHash` — SHA-256 of the invitation token, **unique index**. The raw token is
  returned exactly once, when generated or rotated, and never stored (ADR-005).
- `tokenVersion` — incremented on rotation so old links can be reported as expired rather
  than merely "not found".
- `status` — `pending` until anyone responds, `partial` while some guests are still
  `pending`, `complete` when every guest has responded. Maintained by a hook so the
  dashboard can filter without aggregating.
- `messageToCouple` — belongs to the party, not the individual guest.

### Guests

An individual person. Always belongs to exactly one party (`ON DELETE CASCADE` — deleting
a party removes its guests).

- `rsvpStatus` is the single source of current truth (ADR-009).
- `table` is a nullable FK. `NULL` means unassigned, which is exactly the
  "unassigned guests" query the seating planner needs.
- `isPlusOne` marks a placeholder seat the inviting guest may name later.
- `ageGroup` drives children's menu eligibility and adult/child counts for the caterer.
- PII (`email`, `phone`, dietary, allergies, accessibility) is minimised and never logged.

### Tags

Free-form organiser labels ("bride's side", "evening only"). Many-to-many with guests.

### MenuCourses / MenuOptions / GuestMealSelections

Courses are ordered (Starter, Main, Dessert, Children's, Drinks). `required` drives the
"missing selection" report. `childrenOnly` restricts a course to `ageGroup = child`.

A selection is unique per `(guest, course)` — a guest picks at most one option per course.
Enforced with a unique constraint, because the RSVP form and the organiser dashboard can
both write.

Supports the menu models in the brief: a fixed menu is a course with one option;
"no advance selection" is the feature flag turned off.

### Tables / seating

`Guest.table` is the assignment. `capacity` is advisory — the planner **warns** on
over-capacity rather than rejecting, because organisers legitimately squeeze in a chair.
`positionX/Y` store planner layout, not a floor plan (no CAD editor in MVP).

### ItineraryItems

Ordered timeline. `visibility` separates the guest-facing schedule from internal
supplier timings.

### PhotoGroups / PhotoGroupMembers / PhotoQueueState

A guest may belong to several groups; `PhotoQueueState` (global) holds the pointer to the
current group. Statuses are `queued → get_ready → now → completed`, with `skipped` as an
escape hatch. Valid transitions are enforced in the service layer, not the UI, and are
directly unit-tested.

"How far away is my group?" is computed from `order` relative to the current group.

### Notifications

One row per delivery attempt chain. `dedupeKey` is **unique** — this is the deduplication
mechanism the brief requires, enforced by the database rather than by application logic,
so concurrent workers cannot double-send.

### AuditEvents

Append-only. Records who changed what. `ipHash` is a salted hash, never a raw IP.
Provides RSVP history (ADR-009) without a second source of current state.

---

## Indexes and constraints

| Purpose                    | Definition                                  |
| -------------------------- | ------------------------------------------- |
| Invitation lookup          | `UNIQUE` on `invitation_parties.token_hash` |
| Guest listing / party page | index on `guests.party`                     |
| RSVP dashboard counts      | index on `guests.rsvp_status`               |
| Unassigned + table views   | index on `guests.table`                     |
| One choice per course      | `UNIQUE (guest, course)` on meal selections |
| Notification dedupe        | `UNIQUE` on `notifications.dedupe_key`      |
| Queue ordering             | index on `photo_groups.order`               |
| Table naming               | `UNIQUE` on `tables.name`                   |
| Organiser login            | `UNIQUE` on `users.email` (Payload default) |

## Transactions

RSVP submission writes guest statuses, meal selections, the party status, and an audit
event. It runs in a single transaction via Payload's `req.transactionID` so a partial
household response can never be persisted.
