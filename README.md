# CareOps

Proof-of-care for Thailand's home-based elderly care.

Every home visit becomes a **tamper-evident "Care Receipt"**: the caregiver checks in with GPS + photo, logs vitals/meds/notes, checks out, and the family gets an automatic LINE report — plus a PromptPay invoice. The care records form a **hash-chained ledger** that proves what happened and when.

## The one thing

> Proof-of-care with automatic family updates. Everything else is bought, borrowed (LINE), or deferred.

## Stack

TypeScript + Next.js (App Router, PWA + LIFF-ready) → Supabase (Postgres + RLS + Auth) → LINE (Messaging API) → PromptPay QR → Vercel.

## Project layout

```
supabase/schema.sql        # full schema + RLS + hash-chain trigger + verify fn
supabase/seed.sql          # demo org + patients + role setup
src/app/api/               # checkin, checkout, records, invoices/qr, line/webhook
src/app/caregiver/visits   # caregiver flow (check-in → care log → check-out)
src/app/operator/dashboard # operator: list/create visits
src/app/family             # family: see care records + pay via QR
src/lib/                   # supabase clients, promptpay, line, types
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. (Optional) run `supabase/seed.sql` to create a demo org + patients.
4. **Authentication → Providers → Email**: enable Email, and for local testing set
   "Confirm email" to off (or handle confirmation).
5. Copy project URL + anon key + service role key into `.env.local`.

### 2. Environment

```bash
cp .env.example .env.local
# fill in real values
```

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 4. Create accounts and assign roles

1. Sign up an **operator** in the app.
2. In Supabase → **Table Editor → profiles**, set that user's `role = 'operator'`
   and `org_id` to your organization id (see `seed.sql`).
3. Sign up a **caregiver**, set `role = 'caregiver'`, same `org_id`.
4. Sign up a **family** member, set `role = 'family'`, then link them to a patient:
   ```sql
   insert into public.patient_family (patient_id, family_user_id, relation)
   values ('<patient-uuid>', '<family-user-uuid>', 'ลูกสาว');
   ```

### 5. LINE (automatic family report)

1. Create a **Messaging API** channel at [LINE Developers](https://developers.line.biz/).
2. Copy the channel access token + secret into `.env.local`.
3. Set the webhook URL to `https://<your-domain>/api/line/webhook`.
4. The family user must have a `line_user_id` in `profiles` (set it manually for the
   MVP, or extend `/api/line/webhook` to bind a LINE id on 'follow').

### 6. PromptPay (invoice QR)

Set the operator's `promptpay_receiver_id` on the `organizations` row (13-digit
phone or national ID). The invoice QR is generated from this.

## The trust graph (how the ledger works)

`care_records` is append-only (no UPDATE/DELETE policies). On insert, a trigger
computes a `digest = sha256(prev_digest | kind | payload | actor | timestamp)`,
chaining every record of a visit. `verify_care_chain(visit_id)` (SQL) recomputes
and returns false if any link was tampered with. The API exposes this as
`chain_valid` on `GET /api/visits/:id/records`.

## Known MVP simplifications

- Check-in photo is stored as a downscaled data URL in `check_in_photo_url`.
  Move to Supabase Storage before production.
- LINE family reports require a manually-set `line_user_id`. Webhook binding is a TODO.
- PWA manifest uses an SVG icon; add PNG icons (192/512) for full installability.
- Hash-chain ordering uses a per-table identity `seq` + advisory lock (fine for MVP).

## Roadmap

- [ ] LINE webhook: bind `line_user_id` on follow + `link <code>` flow
- [ ] Offline-first check-in (background sync) for rural coverage
- [ ] Caregiver reliability score + micro-certifications (reputation graph)
- [ ] Shift marketplace + hospital referral portal
- [ ] Scam/digital-safety alerts for families (year-2 feature)
