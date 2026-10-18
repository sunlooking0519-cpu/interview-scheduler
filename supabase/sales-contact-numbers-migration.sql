-- Supabase SQL Editor에서 한 번 실행하세요. 기존 phone의 휴대폰 번호만 mobile로 옮깁니다.
-- T/Tel 전화번호는 phone에 남기고 Fax는 저장하지 않습니다.
begin;

alter table scheduler.sales_contacts
  add column if not exists mobile text;

comment on column scheduler.sales_contacts.phone is 'Business card telephone (T/Tel), excluding fax and mobile';
comment on column scheduler.sales_contacts.mobile is 'Business card mobile number (M/Mobile)';

update scheduler.sales_contacts
set mobile = phone, phone = null
where coalesce(trim(mobile), '') = ''
  and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
      ~ '^(01[016789][0-9]{7,8}|821[016789][0-9]{7,8})$';

-- Previously recognized cards stored mobile numbers under the old phone key.
update scheduler.sales_business_cards
set ocr_fields = jsonb_set(ocr_fields - 'phone', '{mobile}', to_jsonb(ocr_fields ->> 'phone'), true)
where jsonb_typeof(ocr_fields) = 'object'
  and coalesce(ocr_fields ->> 'mobile', '') = ''
  and regexp_replace(coalesce(ocr_fields ->> 'phone', ''), '[^0-9]', '', 'g')
      ~ '^(01[016789][0-9]{7,8}|821[016789][0-9]{7,8})$';

commit;
notify pgrst, 'reload schema';
