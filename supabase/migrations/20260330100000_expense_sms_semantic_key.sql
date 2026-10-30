-- 동일 결제(한 줄/여러 줄 등 형식 차) 중복 방지 — fingerprint와 별도
-- 기존 행은 sms_semantic_key NULL 유지 (임의 backfill 없음)

begin;

alter table public.expenses
  add column if not exists sms_semantic_key text;

comment on column public.expenses.sms_semantic_key is
  '확인연도+날짜+시간+금액+가맹점 canonical SHA-256 (원문 형식과 무관)';

create unique index if not exists expenses_user_sms_semantic_year_uidx
  on public.expenses (user_id, sms_confirmed_year, sms_semantic_key)
  where sms_semantic_key is not null and sms_confirmed_year is not null;

commit;
