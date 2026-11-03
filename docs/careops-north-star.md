# CareOps — Thailand Home-Based Elderly Care (Proof-of-Care) — North Star

> Status: idea validated at research level; **customer/payer hypothesis NOT yet proven.**
> Next action: run the 20-contact pre-sell test (operator pays vs family pays).

## One-liner
A Line-first SaaS that turns every home-care visit into a tamper-evident "Care Receipt" sent to the family in real time — the trust layer for Thailand's home-based elderly care ("ageing in place").

## Problem
- Thailand is aging fast; ILO projects a **250,000 care-worker shortfall by 2037**; policy keeps elderly **at home**.
- Silver economy ≈ **฿800B**. **844 registered elderly-care businesses** (DBD, Nov 2025), +35.59% since 2022.
- Home-care operators run on **Line/Excel/paper**; families have **no verifiable record** of care.
- CloudNurse owns *residential nursing homes* (facility ERP); the *home-based* layer is unserved.

## Customer / payer — UNRESOLVED (the key risk)
- Assumed: small home-care **operators** (B2B, ฿1,500–3,000/month).
- Contingency: **families** (B2C, ฿299–499/month visibility layer).
- Hospital = referral **channel**, not buyer.

## Product (the visit lifecycle IS the product)
assign → check-in (GPS/photo) → log vitals/meds/notes → check-out → auto LINE report to family → PromptPay invoice.

## Stack
TypeScript + Next.js (PWA + LIFF) → Supabase (Postgres + RLS + Auth + Storage) → LINE (Login + Messaging API + LIFF) → Longdo Map + OSRM → Web Speech API → Stripe PromptPay → Vercel.

## Moats
1. **Trust Graph** — tamper-evident Care Receipt (geolocated check-in, EXIF-verified photo, meds scanned, append-only hashed ledger).
2. **Caregiver Reputation Graph** — certifications + reliability score (on-time %, meds completion, family ratings) from visit data → shift marketplace.
3. **Line-native distribution** — zero-install family experience; "care circle" for siblings split across cities/countries.

## Plan
2 wk discovery → 5 wk MVP → 3 wk billing → 3 wk beta + PDPA → launch corridor (Phetchaburi–Cha-am–Hua Hin) → marketplace + government (สปสช./อสม.) in Year 2.

## Stress-test findings (top threats)
1. **B2B customer thinner than assumed** — Phetchaburi had ~0 formal home-care agencies; 844 registered operators are mostly nursing homes (CloudNurse's turf).
2. **Real buyer may be the family (B2C)**, not the operator.
3. **Trust-graph cold-start** — two-sided stall (families want it only if operators adopt; vice versa).
4. **Incumbent pivot** — CloudNurse could add field dispatch and cross-sell.
5. **"Proof of care" = legal liability** — PDPA + possible medical-device classification.
6. **Founder-channel mismatch** — 22yo selling to 50yo nurse-entrepreneurs; leverage the doctor sister.

## Escape hatch (if B2B fails)
Sell the **visibility layer to families directly** (B2C, ฿299–499/month) — no marketplace, no supply risk. Same code, different payer.
