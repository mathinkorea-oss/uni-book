-- 읽기 전용: public.expenses RLS 정책 점검 (SQL Editor에서 실행)
-- 마이그레이션의 drop policy 목록과 이름이 다르면 예전 전체 허용 정책이 남을 수 있습니다.

-- 1) 현재 정책 전체 목록
select
  policyname,
  permissive,
  roles::text as roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'expenses'
order by policyname;

-- 2) 광범위 허용·비표준 정책 후보 (삭제 검토)
--    기대: expenses_*_own 4개만 authenticated, USING/WITH CHECK 에 무조건 true 없음
select
  policyname,
  roles::text as roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression,
  case
    when roles::text ilike '%anon%' then 'role includes anon'
    when roles::text ilike '%public%' and roles::text not ilike '%authenticated%' then 'role includes public'
    when qual is not null and btrim(qual::text) = 'true' then 'using is true'
    when with_check is not null and btrim(with_check::text) = 'true' then 'with_check is true'
    when policyname not in (
      'expenses_select_own',
      'expenses_insert_own',
      'expenses_update_own',
      'expenses_delete_own'
    ) then 'name not in expected own-policy set'
    else 'review manually'
  end as audit_flag
from pg_policies
where schemaname = 'public'
  and tablename = 'expenses'
  and (
    roles::text ilike '%anon%'
    or (
      roles::text ilike '%public%'
      and roles::text not ilike '%authenticated%'
    )
    or (qual is not null and btrim(qual::text) = 'true')
    or (with_check is not null and btrim(with_check::text) = 'true')
    or policyname not in (
      'expenses_select_own',
      'expenses_insert_own',
      'expenses_update_own',
      'expenses_delete_own'
    )
  )
order by policyname;

-- 3) RLS 활성화 여부
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'expenses';

-- 결과 확인 방법
-- - 1번: 정책이 4개이고 이름이 expenses_*_own 인지
-- - 2번: 행이 0건이면 광범위 정책 없음 (행이 있으면 audit_flag 보고 Dashboard에서 삭제)
-- - 3번: rls_enabled = true
