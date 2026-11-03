-- =====================================================================
-- CareOps — seed / demo data
-- 1) Run schema.sql first.
-- 2) Sign up an operator via the app, then set their role + org here
--    (or in the Supabase dashboard). Replace the UUIDs below with yours.
-- =====================================================================

-- --- 1. Organization (replace id with your own, or let it generate) ---
insert into public.organizations (id, name, promptpay_receiver_id)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Home Care',
  '08xxxxxxxxx'   -- <- your PromptPay phone/national ID (13 digits)
)
on conflict (id) do nothing;

-- --- 2. Promote your operator account ---
-- After signing up in the app, find your user id (Auth > Users) and run:
-- update public.profiles
--   set role = 'operator', org_id = '00000000-0000-0000-0000-000000000001'
--   where id = '<your-auth-user-uuid>';

-- --- 3. Demo patients (Phetchaburi area coordinates) ---
insert into public.patients (id, org_id, full_name, address, lat, lng, geofence_m, care_notes)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'คุณยายสมศรี', 'อ.เมือง เพชรบุรี', 13.1100, 99.9400, 200, 'ความดันสูง ดูแลยาเช้า-เย็น'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'คุณลุงประสิทธิ์', 'อ.ชะอำ เพชรบุรี', 12.7990, 99.9680, 200, 'ผู้ป่วยติดเตียง ต้องพลิกตัวทุก 2 ชม.')
on conflict (id) do nothing;

-- --- 4. Link a family account to a patient (after the family user signs up) ---
-- update public.profiles set role = 'family' where id = '<family-user-uuid>';
-- insert into public.patient_family (patient_id, family_user_id, relation)
-- values ('10000000-0000-0000-0000-000000000001', '<family-user-uuid>', 'ลูกสาว');
