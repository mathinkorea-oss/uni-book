-- 신한 법인카드 SMS 중복 방지 (원문 미저장, fingerprint + 확인 연도)
-- Supabase SQL Editor: 파일 전체를 한 번에 실행

begin;

-- 이전 date 기준 유니크 인덱스(부분 적용 잔재) 제거
drop index if exists public.expenses_user_sms_fingerprint_date_uidx;

alter table public.expenses
  add column if not exists sms_fingerprint text,
  add column if not exists payment_time text,
  add column if not exists sms_confirmed_year integer;

comment on column public.expenses.sms_fingerprint is '정규화 SMS SHA-256 hex 64자 (원문 미저장)';
comment on column public.expenses.payment_time is '승인 문자의 HH:MM (선택)';
comment on column public.expenses.sms_confirmed_year is '사용자가 확인한 결제 연도 (지출 date 수정과 무관)';

alter table public.expenses
  drop constraint if exists expenses_sms_pair_check;

alter table public.expenses
  add constraint expenses_sms_pair_check
  check (
    (sms_fingerprint is null and sms_confirmed_year is null)
    or (
      sms_fingerprint is not null
      and sms_confirmed_year is not null
      and sms_fingerprint ~ '^[a-f0-9]{64}$'
      and sms_confirmed_year between 2000 and 2100
    )
  ) not valid;

create unique index if not exists expenses_user_sms_fingerprint_year_uidx
  on public.expenses (user_id, sms_fingerprint, sms_confirmed_year)
  where sms_fingerprint is not null and sms_confirmed_year is not null;

-- 삭제 마커: 신규 설치용 테이블 정의
create table if not exists public.expense_sms_deleted_markers (
  user_id uuid not null references auth.users (id) on delete cascade,
  sms_fingerprint text not null,
  sms_confirmed_year integer not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, sms_fingerprint, sms_confirmed_year),
  constraint expense_sms_deleted_markers_fingerprint_check
    check (sms_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint expense_sms_deleted_markers_year_check
    check (sms_confirmed_year >= 2000 and sms_confirmed_year <= 2100)
);

-- 구(date 기준) 마커 테이블이 이미 있으면 컬럼·인덱스만 보강 (행 삭제 없음)
alter table public.expense_sms_deleted_markers
  add column if not exists sms_confirmed_year integer;

alter table public.expense_sms_deleted_markers
  drop constraint if exists expense_sms_deleted_markers_fingerprint_check;

alter table public.expense_sms_deleted_markers
  add constraint expense_sms_deleted_markers_fingerprint_check
  check (sms_fingerprint ~ '^[a-f0-9]{64}$') not valid;

alter table public.expense_sms_deleted_markers
  drop constraint if exists expense_sms_deleted_markers_year_check;

alter table public.expense_sms_deleted_markers
  add constraint expense_sms_deleted_markers_year_check
  check (
    sms_confirmed_year is null
    or (sms_confirmed_year >= 2000 and sms_confirmed_year <= 2100)
  ) not valid;

-- 구 PK(expense_date)와 공존 가능: 확인 연도가 있는 신규 마커용 유니크
create unique index if not exists expense_sms_deleted_markers_user_fp_year_uidx
  on public.expense_sms_deleted_markers (user_id, sms_fingerprint, sms_confirmed_year)
  where sms_confirmed_year is not null;

alter table public.expense_sms_deleted_markers enable row level security;

drop policy if exists "sms_deleted_markers_select_own" on public.expense_sms_deleted_markers;
drop policy if exists "sms_deleted_markers_insert_own" on public.expense_sms_deleted_markers;
drop policy if exists "sms_deleted_markers_update_own" on public.expense_sms_deleted_markers;
drop policy if exists "sms_deleted_markers_delete_own" on public.expense_sms_deleted_markers;

create policy "sms_deleted_markers_select_own"
  on public.expense_sms_deleted_markers
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "sms_deleted_markers_insert_own"
  on public.expense_sms_deleted_markers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sms_deleted_markers_update_own"
  on public.expense_sms_deleted_markers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sms_deleted_markers_delete_own"
  on public.expense_sms_deleted_markers
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.expense_sms_deleted_markers to authenticated;

create or replace function public.delete_expense_with_sms_marker(p_expense_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $delete_expense_with_sms_marker$
declare
  v_uid uuid;
  v_deleted public.expenses%rowtype;
  v_has_expense_date boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  delete from public.expenses
  where id = p_expense_id
    and user_id = v_uid
  returning * into v_deleted;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_deleted.sms_fingerprint is not null
     and v_deleted.sms_confirmed_year is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'expense_sms_deleted_markers'
        and column_name = 'expense_date'
    ) into v_has_expense_date;

    if v_has_expense_date then
      insert into public.expense_sms_deleted_markers (
        user_id,
        sms_fingerprint,
        sms_confirmed_year,
        expense_date
      )
      values (
        v_uid,
        v_deleted.sms_fingerprint,
        v_deleted.sms_confirmed_year,
        v_deleted.date
      )
      on conflict (user_id, sms_fingerprint, sms_confirmed_year)
      where sms_confirmed_year is not null
      do update set deleted_at = now();
    else
      insert into public.expense_sms_deleted_markers (
        user_id,
        sms_fingerprint,
        sms_confirmed_year
      )
      values (
        v_uid,
        v_deleted.sms_fingerprint,
        v_deleted.sms_confirmed_year
      )
      on conflict (user_id, sms_fingerprint, sms_confirmed_year)
      where sms_confirmed_year is not null
      do update set deleted_at = now();
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_deleted.id);
end;
$delete_expense_with_sms_marker$;

revoke all on function public.delete_expense_with_sms_marker(uuid) from public;
grant execute on function public.delete_expense_with_sms_marker(uuid) to authenticated;

commit;
