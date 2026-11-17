# Eye exam booking — setup & staff rules

Online booking at `book.html` uses the store's existing Google Calendar
(**eyenoonoptical@gmail.com**, the "Stacy w Lee" calendar), the same one phone
staff already use. Until it's connected on Render, the page shows
"Online booking opens soon — call us".

## How it works (same as the staff already do it)

- Every bookable exam time is a 30-min event titled **`Eye Exam`** = an open slot.
- The website offers **only** those `Eye Exam` slots (capital letters don't matter).
- A web booking **renames** that slot to `[WEB] Name / Phone / Service` (green) and
  puts the email/notes in the description.
- If the customer cancels from their email link, it turns back into `Eye Exam`.
- So **staff decide the days and hours** just by which `Eye Exam` slots exist.

---

## 1. Connection (done once)

- Service account (robot): `eyenoon-booking@eyenoon-booking.iam.gserviceaccount.com`
  (Google Cloud project `eyenoon-booking`, Calendar API on, JSON key downloaded).
- The "Stacy w Lee" calendar is shared with the robot:
  **Make changes and see all event details**.
- Render env vars on the API service (`eyenoon-api`):

  | Var | Value |
  |---|---|
  | `GOOGLE_CALENDAR_ID` | `eyenoonoptical@gmail.com` |
  | `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole JSON key file content (paste as one value) |
  | `BOOKING_SECRET` | any long random string (Render → Generate) — signs cancel links |
  | `BOOKING_NOTIFY_EMAIL` | optional: store inbox that gets a copy of each web booking/cancel |
  | `PUBLIC_SITE_URL` | `https://eyenoonoptical.com` (cancel links point to `<this>/book.html`) |

  On start the API logs `Booking : Google Calendar (eyenoonoptical@gmail.com)`.
  If something is missing it logs `Booking : OFF …` and checkout keeps working.

Optional: `BOOKING_MIN_NOTICE_MINUTES` (default 120 — how soon the next bookable
slot is), `BOOKING_DAYS_AHEAD` (default 60).

---

## 2. Rules for phone staff (send this to the team)

1. Keep doing what you do: open times are events called **`Eye Exam`**.
   To book a phone patient, **rename** the `Eye Exam` slot to the patient's name.
2. **Don't create a second event on top of an `Eye Exam` slot** — rename the slot
   instead. (If you do stack one, the website treats the time as taken.)
3. Web bookings appear as **`[WEB] Name / Phone / Service`** in green.
   To cancel or move one, edit it like any other booking. To free the time again,
   rename it back to `Eye Exam`.
4. Days off / doctor out: delete those `Eye Exam` slots, or add an all-day
   "Closed" event — anything that isn't titled `Eye Exam` blocks the time.
5. Calendar time zone must be **Los Angeles** (Settings → General → Time zone).
6. Don't put medical/prescription details in event titles or descriptions.

## 3. How double-booking is prevented

The website renames a slot only if it is still exactly the `Eye Exam` event it
just read (Google's If-Match/etag check). If staff renamed it a second earlier,
Google refuses, and the customer is asked to pick another time. **Staff always win.**

## 4. Local testing

```bash
cd server && npm start          # API on :4242 — simulates Wed/Fri/Sat 9:30–17:30 "Eye Exam" slots
py -3 -m http.server 8765       # in Website/, then open http://127.0.0.1:8765/book.html
```
(Set `ALLOWED_ORIGIN=http://127.0.0.1:8765` for the API when testing this way.)
To simulate staff booking a slot by phone, put this in `server/.bookings-dev.json`:
`{ "ph_2026-11-18T18:00:00.000Z": { "title": "Jane Doe", "v": 1 } }`
