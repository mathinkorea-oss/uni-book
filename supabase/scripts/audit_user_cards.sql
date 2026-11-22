-- user_cards 마이그레이션 검증
-- ① 적용 전: "SECTION A" 실행 후 결과 저장
-- ② 20260401100000_user_cards.sql 실행
-- ③ "SECTION B~" 실행 후 A와 비교

/* =============================================================================
   SECTION A — 적용 전 기준선 (마이그레이션 전 1회)
============================================================================= */

-- A1) 컬럼 없음 확인 (적용 전에는 0행)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'expenses'
  and column_name in ('card_id', 'installment_months');

-- A2) 사용자별 지출 건수·총액 (적용 후 A3과 반드시 일치)
select
  user_id,
  count(*) as expense_count,
  coalesce(sum(amount), 0) as total_amount
from public.expenses
where user_id is not null
group by user_id
order by user_id;

-- A3) 전체 요약
select
  count(*) filter (where user_id is not null) as expenses_with_user,
  count(*) filter (where user_id is null) as expenses_legacy_null_user,
  coalesce(sum(amount) filter (where user_id is not null), 0) as total_amount_with_user
from public.expenses;

-- A4) 삭제 마커 건수 (card_id 없는 상태 기준)
select count(*) as delete_marker_rows
from public.expense_sms_deleted_markers;

-- A5) 기존 중복·SMS 인덱스 이름 (적용 전)
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('expenses', 'expense_sms_deleted_markers')
  and indexname in (
    'expenses_user_sms_fingerprint_year_uidx',
    'expenses_user_sms_fingerprint_date_uidx',
    'expenses_user_sms_semantic_year_uidx',
    'expense_sms_deleted_markers_user_fp_year_uidx'
  )
order by indexname;

/* =============================================================================
   SECTION B — 적용 후 스키마·집계
============================================================================= */

-- B1) user_cards 존재
select count(*) as card_rows from public.user_cards;

-- B2) 사용자별 지출 — SECTION A2와 user_id·expense_count·total_amount 동일해야 함
select
  user_id,
  count(*) as expense_count,
  coalesce(sum(amount), 0) as total_amount
from public.expenses
where user_id is not null
group by user_id
order by user_id;

-- B3) user_id 있는 지출 중 card_id NULL (기대 0)
select count(*) as expenses_with_user_missing_card
from public.expenses
where user_id is not null
  and card_id is null;

-- B4) user_id NULL 레거시 (A3의 expenses_legacy_null_user와 동일, card_id 미요구)
select
  count(*) as legacy_null_user_expenses,
  coalesce(sum(amount), 0) as legacy_total_amount
from public.expenses
where user_id is null;

-- B5) 카드별 지출·금액
select
  uc.user_id,
  uc.display_name,
  uc.code,
  count(e.id) as expense_count,
  coalesce(sum(e.amount), 0) as total_amount
from public.user_cards uc
left join public.expenses e on e.card_id = uc.id
group by uc.user_id, uc.id, uc.display_name, uc.code
order by uc.user_id, uc.sort_order;

/* =============================================================================
   SECTION C — 소유자·삭제 마커 일치
============================================================================= */

-- C1) 지출: card 소유 ≠ expense.user_id (기대 0행)
select e.id, e.user_id, e.card_id, uc.user_id as card_owner
from public.expenses e
join public.user_cards uc on uc.id = e.card_id
where e.user_id is distinct from uc.user_id;

-- C2) 삭제 마커: card 소유 불일치 (기대 0행) — KB·법인 공통
select m.user_id, m.card_id, uc.user_id as card_owner, uc.code as card_code
from public.expense_sms_deleted_markers m
left join public.user_cards uc on uc.id = m.card_id
where m.card_id is not null
  and m.user_id is distinct from uc.user_id;

-- C3) 삭제 마커: confirmed_year 있으나 card_id NULL (기대 0) — 재등록 차단 유지
select count(*) as markers_missing_card_with_year
from public.expense_sms_deleted_markers
where sms_confirmed_year is not null
  and sms_fingerprint is not null
  and card_id is null;

-- C4) 【마이그레이션 직후 1회만】 구 삭제 마커 법인(backfill) 누락
--     card_id 가 아직 NULL 이거나, 유효한 카드 행이 없는 경우만.
--     ※ 신버전에서 KB(kb_8091) 삭제로 생성된 마커는 이 점검 대상이 아님 → C5·C2 참고
select
  m.user_id,
  m.card_id,
  m.sms_confirmed_year,
  'backfill_missing' as check_kind
from public.expense_sms_deleted_markers m
where m.sms_confirmed_year is not null
  and m.sms_fingerprint is not null
  and (
    m.card_id is null
    or not exists (
      select 1 from public.user_cards uc where uc.id = m.card_id
    )
  );

-- C5) 【운영 지속】 삭제 마커 카드 코드 분포 (KB 연결은 정상, 0행이어도 OK)
select uc.code, count(*) as marker_count
from public.expense_sms_deleted_markers m
join public.user_cards uc on uc.id = m.card_id and uc.user_id = m.user_id
where m.sms_confirmed_year is not null
group by uc.code
order by uc.code;

/* =============================================================================
   SECTION D — 인덱스·ON CONFLICT 대응 (적용 후 기대)
============================================================================= */

-- D1) 신규 카드 단위 인덱스 존재
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'expenses_user_card_sms_fp_year_uidx',
    'expenses_user_card_sms_semantic_year_uidx',
    'expense_sms_deleted_markers_user_card_fp_year_uidx',
    'user_cards_user_code_uidx'
  )
order by indexname;

-- D2) 구 인덱스 제거 확인 (기대 0행)
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'expenses_user_sms_fingerprint_year_uidx',
    'expenses_user_sms_semantic_year_uidx',
    'expense_sms_deleted_markers_user_fp_year_uidx'
  );

/* =============================================================================
   SECTION E — 트리거·RLS
============================================================================= */

-- E1) expenses 트리거 (user_id → card 순; UPDATE 시 card_id·user_id 검증)
select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.expenses'::regclass
  and not tgisinternal
  and tgname in (
    'expenses_set_user_id_trigger',
    'expenses_validate_card_id_trigger',
    'expenses_prevent_user_id_change_trigger'
  )
order by tgname;

-- E2) user_cards / 삭제 마커 트리거 (UPDATE 시 card_id·user_id 검증)
select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in (
    'user_cards_prevent_user_id_change_trigger',
    'expense_sms_deleted_markers_validate_card_trigger'
  )
order by c.relname, t.tgname;

-- E3) user_cards RLS 활성화 여부 (relrowsecurity = true 기대)
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_cards';

-- E4) user_cards RLS 정책 목록
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'user_cards'
order by policyname;

-- E5) 함수 존재
select
  p.proname,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'seed_default_user_cards',
    'ensure_user_cards',
    'delete_expense_with_sms_marker',
    'expenses_validate_card_id',
    'expense_sms_deleted_markers_validate_card'
  )
order by p.proname;

/* =============================================================================
   SECTION F — 계정당 shinhan_corp + kb_8091 (둘 다 있어야 함)
============================================================================= */

-- F1) 필수 코드 중 하나라도 없는 user_id (기대 0행)
with codes as (
  select user_id, array_agg(code) as codes
  from public.user_cards
  group by user_id
)
select user_id, codes
from codes
where not (
  'shinhan_corp' = any (codes)
  and 'kb_8091' = any (codes)
)
order by user_id;

-- F2) 참고: 카드 행이 하나도 없는 auth 사용자 (지출·마커 없이 신규 로그인 전)
select u.id as user_id
from auth.users u
where not exists (
  select 1 from public.user_cards uc where uc.user_id = u.id
)
order by u.id
limit 20;