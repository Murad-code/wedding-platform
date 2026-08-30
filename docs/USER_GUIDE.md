# Using the platform

A guide to what the application does and how to run a wedding with it. Written for the
person organising — no technical knowledge assumed. For deploying a new wedding, see
`docs/CLIENT_DEPLOYMENT.md`.

---

## 1. The two halves

There are two completely separate experiences, and it helps to keep them apart in your
head.

|                     | Who sees it                        | Where                                   |
| ------------------- | ---------------------------------- | --------------------------------------- |
| **Dashboard**       | You and whoever you invite to help | `/dashboard`, sign-in required          |
| **Wedding website** | Your guests                        | `/`, public — no accounts, no passwords |

Guests never create an account. Each household gets a private link instead. That link
_is_ their identity, which is why the platform treats it like a password.

---

## 2. Signing in

Go to `/dashboard`. You will be asked to sign in.

Three kinds of account:

- **Admin** — everything, including adding and removing other organisers.
- **Organiser** — everything except managing accounts. This is the couple's account.
- **Viewer** — can look, cannot change anything. Useful for a parent or a planner who
  wants to follow along without being able to move the seating plan.

### What each role can do

|                                                    | Viewer | Organiser | Admin |
| -------------------------------------------------- | ------ | --------- | ----- |
| See everything in the dashboard                    | ✅     | ✅        | ✅    |
| Change anything — guests, seating, menu, the queue | —      | ✅        | ✅    |
| Send messages to guests                            | —      | ✅        | ✅    |
| Create and remove organiser accounts, change roles | —      | —         | ✅    |
| Reach `/admin`                                     | —      | —         | ✅    |

Nobody can change their own role, including an admin editing their own profile. That is
deliberate: it is the difference between "a viewer account" and "a viewer account until
somebody works out how to edit it".

### Creating accounts

**There are no default credentials.** The first account is created deliberately, from the
command line:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-characters' ADMIN_NAME='Your Name' pnpm create-admin
```

After that, an admin adds everyone else through `/admin` → Users. There is not yet a
friendly screen for this in the dashboard itself — it is on the list.

`/admin` is a technical maintenance screen restricted to admins. Apart from adding
accounts, you should never need it: everything you actually do lives in `/dashboard`.

---

## 3. Set the wedding up (do this first)

**`/dashboard/settings`**

Fill this in before anything else, because the guest website is built from it and the
RSVP form will not make sense without it.

- Your names, the date and time, and the **timezone**. The timezone matters: it is used
  to show every guest the ceremony time you meant, not the time in whatever country they
  happen to be in.
- **RSVP deadline** — after this, guests can no longer change their answer. It is
  enforced by the server, not just by hiding the button.
- Ceremony and reception venues: name, address, start time, map link.
- Welcome message, dress code, travel, parking, and accommodation notes.
- **FAQs** — question and answer pairs shown on the website.
- **Sections and features** — switches for the RSVP, menu, seating, itinerary, photos,
  contacts, and text messages. A section you switch off disappears from the website
  entirely; guests do not see an empty page telling them there is nothing there.

Nothing here is in the code. Changing your venue is a form, not a developer.

---

## 4. The guest list

**`/dashboard/parties`** and **`/dashboard/guests`**

The one concept worth understanding: **guests belong to parties**.

A "party" is a household — whoever gets one invitation between them. "The Kamali Family"
is a party containing Murad, Priya, and Ada. "Ellen Whitfield" is a party containing one
person. Each party gets one link, and everyone in it answers on the same page.

### Adding people

Three ways:

1. **One at a time.** `/dashboard/parties` → name the party → add guests to it.
2. **From a spreadsheet.** `/dashboard/guests/import` → upload a CSV.
3. **Plus-ones.** Set how many a party is allowed. A plus-one is a placeholder seat the
   guest can name later.

### The spreadsheet import

Only two columns are required: `party` and `firstName`. Everything else is optional:

```
party, firstName, lastName, ageGroup, email, phone, rsvpStatus,
dietaryRequirements, allergies, accessibilityNeeds, notes
```

Headers are forgiving — `household`, `group`, `surname`, `dietary`, `rsvp` and similar
all work. `ageGroup` is `adult`, `child`, or `infant`.

**You always see a preview before anything is saved.** It shows what will be imported,
which rows will be skipped and why, and any duplicates. Nothing is written until you
confirm. Re-uploading a corrected file does not create everyone twice — people already
on the list are skipped.

### Working with the list

`/dashboard/guests` gives you search, filters (RSVP status, party, tag, unassigned
seating, dietary needs), and sorting. **Filters live in the URL**, so you can bookmark
"everyone still to reply" or send it to someone.

Select several guests to mark them attending or declined, seat them at a table, or delete
them in one go. "Export CSV" downloads exactly what you are currently looking at, filters
and all.

---

## 5. Invitations

**`/dashboard/parties/<party>`** → "Create invitation link"

You get a link like `yourwedding.com/invite/kR3f…`. Send it however you like — WhatsApp,
email, on the printed invitation.

Three things to know:

- **The link is shown once.** It is not stored anywhere in readable form, so it cannot be
  shown again. Copy it when you create it.
- **If a link is lost or shared too widely, create a new one.** That immediately stops
  the old one working.
- **Anyone holding the link can see and answer that household's invitation.** Treat it
  like a key. It only ever opens that one household — never anyone else's details, and
  never the guest list.

---

## 6. How guests reply

The guest opens their link and sees their invitation: the date, the venue, your welcome
message, the order of the day, and the RSVP form.

- **Each person answers separately.** Two coming and one not is normal and fully
  supported.
- Anyone attending can add dietary requirements, allergies, and accessibility needs.
- If the menu is switched on, they choose their courses at the same time.
- They can add a message for you and leave contact details.
- **They can come back and change their answer** until the deadline.

You see it immediately on the dashboard.

---

## 7. Menu and catering

**`/dashboard/menu`**

Build courses (Starter, Main, Dessert) and options within each. Per course you can set:

- **Required** — a guest cannot submit without choosing.
- **Children only** — appears only for guests marked `child`.

Mark options vegetarian, vegan, or gluten free and guests see that on the website.

The page shows a live count of who has chosen what. **"Export for the caterer"** gives
you one row per attending guest with their choices, allergies, and dietary requirements
spelled out — the thing your caterer actually asks for.

If a guest changes their mind and declines, their meal choices are cleared automatically,
so nothing is plated for someone who is not coming.

---

## 8. Seating

**`/dashboard/seating`**

Add tables with a name, a number of seats, and a shape. Then place people.

- **Only guests who have accepted appear.** Seating a decline would put a place card in
  front of an empty chair.
- Drag a guest onto a table, **or** use the menu on their name. Both do exactly the same
  thing — the plan is fully usable without a mouse, and works on a tablet.
- Live occupancy on every table, and warnings ordered by how much they matter: "more
  guests than seats" comes before individual full tables, because rearranging cannot fix
  it.
- **Seats are a guide, not a rule.** Put nine people on an eight-person table and the
  software will tell you, then let you. You know your venue.
- Deleting a table returns everyone at it to the unassigned pane rather than losing them.

You can also seat several people at once from the guest list.

---

## 9. The wedding website

Built entirely from what you have already entered.

| Page       | What it shows                             |
| ---------- | ----------------------------------------- |
| `/`        | Names, date, countdown                    |
| `/our-day` | Ceremony, reception, the order of the day |
| `/venue`   | Venue, travel, parking, where to stay     |
| `/menu`    | The menu                                  |
| `/faqs`    | Your FAQs                                 |
| `/contact` | Contacts you have marked visible          |
| `/rsvp`    | Explains that a personal link is needed   |

### Itinerary — `/dashboard/itinerary`

Each moment has a visibility setting, and this is worth getting right:

- **Public** — anyone visiting the website.
- **Guests** — only people who open their invitation link.
- **Internal** — only you. Supplier timings, the surprise, the photographer's call time.
  Internal items never leave the server; they are not hidden with CSS, they are simply
  never sent.

### Contacts — `/dashboard/contacts`

Name, role, phone, WhatsApp, email. **Visible to guests** controls whether it appears on
the website. A hidden contact's number never reaches a guest's browser.

---

## 10. The wedding day: the photo queue

This is the part that saves the afternoon.

The usual group-photo half hour is a photographer shouting names across a lawn while
half the people needed are somewhere else. This replaces it.

### Before the day — `/dashboard/photos`

Write the running order: one entry per photograph, named the way the photographer will
call it out ("Bride's immediate family"). Add who needs to be in each, an optional note
("on the terrace steps"), and roughly how long it takes.

Reorder with the arrow buttons. Guests see these names, so write them for guests.

### On the day — `/dashboard/photos/run`

Four large buttons, usable one-handed while holding a drink:

- **Call next** — finish the current photograph and start the next.
- **Complete** — finish this one without calling anyone over yet.
- **Skip** — someone is missing, move on.
- **Previous** — go back. The single most common wedding-day correction.

Hand this to the photographer's assistant or whoever is helping. **Two people can hold it
at once**: if you both press at the same moment, the second press is refused with an
explanation rather than skipping a group.

### What guests see — `/photos`

Every guest's phone shows **NOW**, **UP NEXT**, and — if they opened their invitation
link — **their own photographs** and how far away they are. The wording changes as they
get closer: calm at a distance, "start making your way over" when they are next,
unmistakable when they are up.

It updates by itself, says plainly whether it is live or reconnecting, and keeps working
on bad venue wifi.

---

## 11. Messages

**`/dashboard/notifications`**

When you call a photograph, the platform can text or email the people in it: "you're
next, start making your way over."

- **Email** goes out if email is configured. **Texts** need SMS switched on in settings
  _and_ the guest's explicit consent.
- A guest with no email and no consented number cannot be reached, and the controller
  tells you how many at the moment you call the group — so you know to go and find them.
- Nobody is messaged twice about the same photograph, even if you step back and re-call
  it.
- This page shows what was sent, what failed and why, and lets you retry.

### About consent

A phone number is not permission. Consent is a separate, explicit tick, recorded with the
date. Guests can give it on the RSVP form (only when you have SMS switched on), and you
can record it on a guest's page when they tell you in person. Unticking it withdraws it.

---

## 12. Things worth knowing

**Nothing exposes your guest list.** There is no page, no search, and no address that
returns your guests to someone who has not signed in. An invitation link only ever opens
that one household.

**Dietary, allergy, and accessibility information is treated as medical data**, because
legally it is. It is not written to logs and not shared with anything you have not set up.

**Delete a guest and everything about them goes** — their meal choices, their place in a
photograph, and any messages sent to them.

**After the wedding**, agree how long to keep the guest list and then delete it. The
platform will not do that on its own; it is your decision.

---

## Quick reference

| I want to…                                 | Go to                             |
| ------------------------------------------ | --------------------------------- |
| Change the date, venue, or what guests see | `/dashboard/settings`             |
| Add a household                            | `/dashboard/parties`              |
| Upload a spreadsheet of guests             | `/dashboard/guests/import`        |
| Find who has not replied                   | `/dashboard/guests` → RSVP filter |
| Send someone their invitation              | `/dashboard/parties/<party>`      |
| Give the caterer their numbers             | `/dashboard/menu` → export        |
| Plan the tables                            | `/dashboard/seating`              |
| Set the order of the day                   | `/dashboard/itinerary`            |
| Plan the photographs                       | `/dashboard/photos`               |
| Run the photographs on the day             | `/dashboard/photos/run`           |
| See what was sent to guests                | `/dashboard/notifications`        |
