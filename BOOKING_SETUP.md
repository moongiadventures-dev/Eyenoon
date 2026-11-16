# Eye exam booking — setup & staff rules

Online booking at `book.html` writes straight into the store's Google Calendar.
The calendar is the single booking ledger: phone staff (Philippines) add
bookings there by hand, the website reads it before offering times.

Until the steps below are done, the API runs on a local test file
(`server/.bookings-dev.json`), so the page works for testing but nothing
reaches a real calendar.

---

## 1. Connect the store calendar (one time, ~20 min)

1. **Pick the calendar.** Use a dedicated calendar such as "EYE:NOON Exams"
   in the store's Google account (Google Calendar → Other calendars → + → Create new calendar).
   Settings → *Time zone* → **(GMT-08:00) Pacific Time – Los Angeles**.
2. **Google Cloud.** https://console.cloud.google.com → new project "eyenoon-booking"
   → APIs & Services → Library → enable **Google Calendar API**.
3. **Service account.** IAM & Admin → Service accounts → Create
   (`eyenoon-booking`). Open it → Keys → Add key → JSON. Download the file.
4. **Share the calendar** with the service account's email
   (`…@eyenoon-booking.iam.gserviceaccount.com`):
   Calendar settings → *Share with specific people* → **Make changes to events**.
5. **Calendar ID.** Calendar settings → *Integrate calendar* → Calendar ID
   (looks like `abc123@group.calendar.google.com`).
6. **Render env vars** on the API service:

   | Var | Value |
   |---|---|
   | `GOOGLE_CALENDAR_ID` | the Calendar ID from step 5 |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole JSON key file content (paste as one value) |
   | `BOOKING_SECRET` | any long random string (signs cancel links) — e.g. `openssl rand -hex 32` |
   | `BOOKING_NOTIFY_EMAIL` | store inbox that gets a copy of each web booking/cancel (optional) |
   | `PUBLIC_SITE_URL` | the live site URL (cancel links point to `<this>/book.html`) |
   | `RESEND_API_KEY` / `FROM_EMAIL` | already used for order receipts; booking emails reuse them |

   On start the API logs `Booking : Google Calendar (<id>)` when connected.

### Optional tuning (env vars, defaults shown)

| Var | Default | Meaning |
|---|---|---|
| `BOOKING_HOURS_JSON` | `{"1":"10:00-18:00","3":"10:00-18:00","5":"10:00-18:00","6":"10:00-18:00"}` | Exam hours per weekday (0=Sun). Lunch break: `"10:00-13:00,14:00-18:00"` |
| `BOOKING_SLOT_MINUTES` | `30` | Length of one exam slot |
| `BOOKING_MIN_NOTICE_MINUTES` | `120` | How soon the next bookable slot is |
| `BOOKING_DAYS_AHEAD` | `60` | How far ahead customers can book |

---

## 2. Rules for phone staff (send this to the team)

1. **Your Google Calendar must be set to Los Angeles time.**
   Settings → General → Time zone → *Primary time zone: (GMT-08:00) Pacific Time – Los Angeles*.
   (Add Manila as a secondary time zone if helpful.) If this is wrong,
   bookings land 15–16 hours off.
2. **Anything on the exam calendar blocks that time on the website** — timed
   events and all-day events alike. So:
   - Phone booking → create an event for the exam time.
   - Day off / lunch / doctor out → create a "Closed" event (all-day or timed).
3. **Title format for phone bookings:** `[PHONE] Name / Phone / Service`
   (web bookings show up as `[WEB] Name / Phone / Service`, in green).
4. **To cancel or move a web booking,** edit or delete the event in the calendar.
   The freed time reopens on the website right away.
5. Don't put medical/prescription details in event titles or descriptions.

---

## 3. How double-booking is prevented

- The website only offers times that have nothing on the calendar.
- Right before saving, the API re-reads the calendar (with a per-slot lock).
- After saving, it reads the slot again; if a phone booking landed in the same
  second, the web booking is removed and the customer is asked to pick another
  time. **The phone booking always wins.**

## 4. Local testing

```bash
cd server && npm start          # API on :4242, uses .bookings-dev.json
py -3 -m http.server 8765       # in Website/, then open http://127.0.0.1:8765/book.html
```
(Set `ALLOWED_ORIGIN=http://127.0.0.1:8765` for the API when testing this way.)
To simulate a phone booking, add an entry to `server/.bookings-dev.json`:
`{ "id": "p1", "start": "2026-11-16T18:00:00.000Z", "end": "2026-11-16T18:30:00.000Z" }`
