-- user_expense_categories 마이그레이션 점검
--
-- 중요: 기본 분류 18개는 마이그레이션 직후 자동 생성되지 않습니다.
-- 각 사용자는 앱 로그인 후 API가 호출하는 ensure_user_expense_categories() 시 생성됩니다.
--
-- 실행 구분
--   [Baseline]  마이그레이션 20260402100000 적용 **전** → 스냅샷 저장
--   [Post DDL]  마이그레이션 적용 직후, 로그인 전 → 테이블·RLS·트리거만
--   [Post app]  대상 사용자 1회 이상 로그인·지출 화면 진입 후 → builtin 18건·조인 점검

-- ========== [Baseline] 적용 전 (20260402100000 실행 전) ==========

-- B0) user_expense_categories 테이블 없음
select count(*) = 0 as table_absent
from information_schema.tables
where table_schema = 'public' and table_name = 'user_expense_categories';

-- B1) 적용 전: 사용자별 지출 건수·총액
select user_id, count(*)::bigint as expense_cnt, coalesce(sum(amount), 0)::bigint as expense_total
from public.expenses
group by user_id
order by user_id;

-- B2) 적용 전: 사용자별 분류 코드별 건수·총액
select
  user_id,
  coalesce(category_code, 'other') as category_code,
  count(*)::bigint as expense_cnt,
  coalesce(sum(amount), 0)::bigint as expense_total
from public.expenses
group by user_id, coalesce(category_code, 'other')
order by user_id, category_code;

-- B3) user_cards 존재 (20260401100000 — 운영 적용됨)
select count(*) > 0 as user_cards_present
from information_schema.tables
where table_schema = 'public' and table_name = 'user_cards';

-- ========== [Post DDL] 마이그레이션 직후 (로그인 전 가능) ==========

-- P1) RLS 활성
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'user_expense_categories';

-- P2) RLS 정책 실제 조건
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'user_expense_categories'
order by policyname;

-- P3) 식별값 변경 방지 트리거
select
  t.tgname,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_expense_categories'
  and not t.tgisinternal;

-- P4) 함수 EXECUTE 권한 (authenticated)
select
  p.proname,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('ensure_user_expense_categories', 'seed_default_user_expense_categories');

-- P5) 마이그레이션 직후: 분류 테이블 행 없음이 정상 (로그인 전)
select count(*)::bigint as category_rows_total
from public.user_expense_categories;

-- ========== [Post app] 로그인·ensure 실행 후 ==========

-- A1) 적용 후: 사용자별 지출 건수·총액 (Baseline B1과 동일해야 함)
select user_id, count(*)::bigint as expense_cnt, coalesce(sum(amount), 0)::bigint as expense_total
from public.expenses
group by user_id
order by user_id;

-- A2) 적용 후: 사용자별 분류 코드별 건수·총액 (Baseline B2와 동일해야 함)
select
  user_id,
  coalesce(category_code, 'other') as category_code,
  count(*)::bigint as expense_cnt,
  coalesce(sum(amount), 0)::bigint as expense_total
from public.expenses
group by user_id, coalesce(category_code, 'other')
order by user_id, category_code;

-- A3) 로그인한 사용자별 기본 분류 18개 (부족한 사용자만 표시)
select
  user_id,
  count(*) filter (where is_builtin) as builtin_count,
  count(*) as total_categories
from public.user_expense_categories
group by user_id
having count(*) filter (where is_builtin) <> 18
order by user_id;

-- A4) expenses.category_code 집계 변화 없음 확인용 (B2 대비 diff는 운영에서 스냅샷 비교)
select
  e.user_id,
  coalesce(e.category_code, 'other') as category_code,
  count(*)::bigint as expense_cnt,
  coalesce(sum(e.amount), 0)::bigint as expense_total
from public.expenses e
group by e.user_id, coalesce(e.category_code, 'other')
order by e.user_id, category_code;

-- A5) 지출에만 있고 분류 마스터에 없는 코드 (레거시·custom — 정상 가능)
select distinct
  e.user_id,
  e.category_code
from public.expenses e
where e.category_code is not null
  and not exists (
    select 1
    from public.user_expense_categories c
    where c.user_id = e.user_id and c.code = e.category_code
  )
order by e.user_id, e.category_code;