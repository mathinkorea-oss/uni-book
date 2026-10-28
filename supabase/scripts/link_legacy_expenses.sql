-- ═══════════════════════════════════════════════════════════════════════════
-- 관리자용: 기존 expenses(user_id NULL) → 내 Auth 사용자 연결
-- Supabase Dashboard → SQL Editor 에서만 실행 (일반 앱 사용자는 실행 불가)
--
-- expenses_prevent_user_id_change_trigger 는 앱 경로의 user_id 변경을 막습니다.
-- 이 스크립트는 해당 트리거만 잠시 비활성화합니다. RLS 는 끄지 않습니다.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create temporary table _uni_link_legacy (
  target_user uuid not null
) on commit drop;

-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- UUID 입력: Authentication → Users → User UID 를 복사해 아래 따옴표 안에만 넣으세요.
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
insert into _uni_link_legacy (target_user)
values (
  '339c8337-0df8-423b-8549-5676ced7a303'::uuid
);
-- ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

-- 1) auth.users 에 UUID 존재 여부 (없으면 롤백)
do $$
declare
  t uuid;
begin
  select target_user into t from _uni_link_legacy limit 1;
  if not exists (select 1 from auth.users where id = t) then
    raise exception 'auth.users에 없는 UUID입니다. Authentication → Users UID를 확인하세요: %', t;
  end if;
end $$;

-- 2) 연결 전 상태 (읽기 전용 미리보기)
select
  p.target_user,
  u.email as target_email,
  (select count(*) from public.expenses where user_id is null) as rows_to_link,
  (select count(*) from public.expenses where user_id is not null) as rows_already_owned
from _uni_link_legacy p
left join auth.users u on u.id = p.target_user;

-- 3) user_id 변경 방지 트리거만 잠시 비활성화 (INSERT 트리거·RLS 유지)
alter table public.expenses disable trigger expenses_prevent_user_id_change_trigger;

-- 4) user_id 가 NULL 인 행만 연결 (다른 소유자 행은 변경하지 않음)
with updated as (
  update public.expenses e
  set user_id = p.target_user
  from _uni_link_legacy p
  where e.user_id is null
  returning e.id
)
select count(*) as linked_row_count from updated;

-- 5) 트리거 재활성화
alter table public.expenses enable trigger expenses_prevent_user_id_change_trigger;

-- 6) 연결 후 결과 확인
select
  p.target_user,
  (select count(*) from public.expenses where user_id is null) as remaining_null_user_id,
  (select count(*) from public.expenses e where e.user_id = p.target_user) as rows_owned_by_target
from _uni_link_legacy p;

commit;
