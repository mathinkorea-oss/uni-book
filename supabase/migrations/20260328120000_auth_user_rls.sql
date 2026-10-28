-- UNITHE 법카노트: Supabase Auth 연동 (user_id + RLS + reorder 보안)
-- 기존 행은 user_id NULL 로 유지됩니다.
-- 연결: supabase/scripts/link_legacy_expenses.sql (관리자·SQL Editor 전용)
--   → expenses_prevent_user_id_change_trigger 를 잠시만 비활성화한 뒤 NULL 행만 UPDATE 합니다.
-- 정책 점검: supabase/scripts/audit_expenses_policies.sql

alter table public.expenses
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists expenses_user_id_date_idx
  on public.expenses (user_id, date desc);

comment on column public.expenses.user_id is 'auth.users — NULL 이면 로그인 사용자에게 보이지 않음';

-- INSERT 시 user_id 자동 설정 (클라이언트가 보낸 user_id 와 불일치 시 거부)
create or replace function public.expenses_set_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from auth.uid() then
    raise exception 'user_id must match authenticated user';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_set_user_id_trigger on public.expenses;
create trigger expenses_set_user_id_trigger
  before insert on public.expenses
  for each row
  execute function public.expenses_set_user_id();

-- 앱·API 경로에서 user_id 변경 금지 (관리자 link 스크립트는 트리거만 잠시 DISABLE)
create or replace function public.expenses_prevent_user_id_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_prevent_user_id_change_trigger on public.expenses;
create trigger expenses_prevent_user_id_change_trigger
  before update on public.expenses
  for each row
  execute function public.expenses_prevent_user_id_change();

alter table public.expenses enable row level security;

-- 광범위한 anon / public 정책 제거 (이름이 다르면 audit_expenses_policies.sql 로 확인)
drop policy if exists "Allow public read" on public.expenses;
drop policy if exists "Allow public select" on public.expenses;
drop policy if exists "Allow public insert" on public.expenses;
drop policy if exists "Allow public update" on public.expenses;
drop policy if exists "Allow public delete" on public.expenses;
drop policy if exists "Allow anon read" on public.expenses;
drop policy if exists "Allow anon select" on public.expenses;
drop policy if exists "Allow anon insert" on public.expenses;
drop policy if exists "Allow anon update" on public.expenses;
drop policy if exists "Allow anon delete" on public.expenses;
drop policy if exists "Enable read access for all users" on public.expenses;
drop policy if exists "Enable insert for all users" on public.expenses;
drop policy if exists "Enable update for all users" on public.expenses;
drop policy if exists "Enable delete for all users" on public.expenses;

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own"
  on public.expenses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "expenses_insert_own"
  on public.expenses
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

create policy "expenses_update_own"
  on public.expenses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses_delete_own"
  on public.expenses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 직접 정렬: void → jsonb 반환 타입 변경 시 CREATE OR REPLACE 불가 → DROP 후 재생성
begin;

drop function if exists public.reorder_expenses_batch(jsonb);

create function public.reorder_expenses_batch(updates jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  elem jsonb;
  uid uuid;
  expected integer;
  distinct_ids integer;
  affected integer;
  total integer := 0;
  row_id uuid;
  sort_val integer;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'authentication required';
  end if;

  if updates is null or jsonb_typeof(updates) <> 'array' then
    raise exception 'updates must be a json array';
  end if;

  expected := jsonb_array_length(updates);
  if expected < 1 then
    raise exception 'updates must not be empty';
  end if;

  select count(distinct e.elem->>'id')
  into distinct_ids
  from jsonb_array_elements(updates) as e(elem);

  if distinct_ids <> expected then
    raise exception 'duplicate expense ids in reorder batch';
  end if;

  for elem in
    select e.elem from jsonb_array_elements(updates) as e(elem)
  loop
    if not (elem ? 'id') or not (elem ? 'sort_order') then
      raise exception 'each item must include id and sort_order';
    end if;

    if elem->>'id' is null or btrim(elem->>'id') = '' then
      raise exception 'each item must include a valid id';
    end if;

    begin
      row_id := (elem->>'id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'invalid id: %', elem->>'id';
    end;

    if elem->>'sort_order' is null or btrim(elem->>'sort_order') = '' then
      raise exception 'sort_order is required for id %', row_id;
    end if;

    begin
      sort_val := (elem->>'sort_order')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid sort_order for id %', row_id;
    end;

    update public.expenses
    set sort_order = sort_val
    where id = row_id
      and user_id = uid;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'reorder failed for id %: not found or not owned by caller', row_id;
    end if;

    total := total + 1;
  end loop;

  if total <> expected then
    raise exception 'reorder partial failure: expected % updates, got %', expected, total;
  end if;

  return jsonb_build_object('updated', total);
end;
$$;

revoke all on function public.reorder_expenses_batch(jsonb) from public;
revoke all on function public.reorder_expenses_batch(jsonb) from anon;
grant execute on function public.reorder_expenses_batch(jsonb) to authenticated;

commit;
