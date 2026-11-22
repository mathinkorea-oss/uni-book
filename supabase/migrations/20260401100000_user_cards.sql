-- 사용자별 카드(법인카드·KB국민카드 8091) + 지출 card_id 연동
-- idempotent: IF NOT EXISTS / ON CONFLICT DO NOTHING
--
-- 설계 범위 (이번 작업)
-- · 로그인 계정마다 카드 2종을 시드: 법인카드(shinhan_corp) + KB국민카드(kb_8091, SMS 끝 8091)
-- · 원장님 계정: 기존 지출·삭제 마커 → 법인카드, KB 8091은 신규 지출·문자용
-- · KB 8091은 코드에 고정; 모든 계정에 동일 2종이 생성되며, 미사용 KB 행만 존재할 수 있음
--
-- 인덱스 교체 (20260329100000 / 20260330100000 대비)
-- · DROP expenses_user_sms_fingerprint_year_uidx
--   → CREATE expenses_user_card_sms_fp_year_uidx (user_id, card_id, sms_fingerprint, sms_confirmed_year)
-- · DROP expenses_user_sms_semantic_year_uidx
--   → CREATE expenses_user_card_sms_semantic_year_uidx (user_id, card_id, sms_confirmed_year, sms_semantic_key)
-- · DROP expense_sms_deleted_markers_user_fp_year_uidx
--   → CREATE expense_sms_deleted_markers_user_card_fp_year_uidx (user_id, card_id, sms_fingerprint, sms_confirmed_year)
--
-- ON CONFLICT 대상 (delete_expense_with_sms_marker)
-- · 구: (user_id, sms_fingerprint, sms_confirmed_year) — 20260329100000 인덱스
-- · 신: (user_id, card_id, sms_fingerprint, sms_confirmed_year) + partial WHERE (이 파일 하단 함수)
--
-- 트리거 실행 순서 (INSERT expenses, 이름순)
-- · 1) expenses_set_user_id_trigger — user_id = auth.uid()
-- · 2) expenses_validate_card_id_trigger — seed_default_user_cards + card_id 기본값/검증

begin;

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  display_name text not null,
  issuer text not null,
  sms_last_digits text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint user_cards_code_check check (code ~ '^[a-z0-9_]+$'),
  constraint user_cards_issuer_check check (issuer in ('shinhan', 'kb')),
  constraint user_cards_sms_digits_check check (
    sms_last_digits is null or sms_last_digits ~ '^\d{4}$'
  )
);

create unique index if not exists user_cards_user_code_uidx
  on public.user_cards (user_id, code);

comment on table public.user_cards is '계정별 카드(마스킹 식별번호만, 전체 번호 미저장)';
comment on column public.user_cards.sms_last_digits is 'SMS 헤더의 끝 4자리 (예: 8091)';

alter table public.expenses
  add column if not exists card_id uuid references public.user_cards (id) on delete restrict;

alter table public.expenses
  add column if not exists installment_months smallint;

comment on column public.expenses.card_id is 'user_cards — 지출이 속한 카드';
comment on column public.expenses.installment_months is '할부 개월 (일시불 null, 총액 1건 기록)';

alter table public.expenses
  drop constraint if exists expenses_installment_months_check;

alter table public.expenses
  add constraint expenses_installment_months_check
  check (
    installment_months is null
    or (installment_months >= 1 and installment_months <= 60)
  ) not valid;

alter table public.expense_sms_deleted_markers
  add column if not exists card_id uuid references public.user_cards (id) on delete cascade;

-- ── 카드 시드 (지출 있는 사용자) ──
insert into public.user_cards (user_id, code, display_name, issuer, sms_last_digits, sort_order)
select distinct e.user_id, 'shinhan_corp', '법인카드', 'shinhan', null, 0
from public.expenses e
where e.user_id is not null
on conflict (user_id, code) do nothing;

-- ── 카드 시드 (지출 없이 삭제 마커만 있는 사용자) ──
insert into public.user_cards (user_id, code, display_name, issuer, sms_last_digits, sort_order)
select distinct m.user_id, 'shinhan_corp', '법인카드', 'shinhan', null, 0
from public.expense_sms_deleted_markers m
where m.user_id is not null
on conflict (user_id, code) do nothing;

-- ── KB 8091: 법인카드가 있는 모든 계정 (미사용 행 허용) ──
insert into public.user_cards (user_id, code, display_name, issuer, sms_last_digits, sort_order)
select uc.user_id, 'kb_8091', 'KB국민카드', 'kb', '8091', 1
from public.user_cards uc
where uc.code = 'shinhan_corp'
on conflict (user_id, code) do nothing;

-- ── 기존 지출 → 법인카드 ──
update public.expenses e
set card_id = uc.id
from public.user_cards uc
where e.user_id = uc.user_id
  and uc.code = 'shinhan_corp'
  and e.card_id is null
  and e.user_id is not null;

-- ── 기존 삭제 마커 → 법인카드 (재등록 차단 동작 유지) ──
update public.expense_sms_deleted_markers m
set card_id = uc.id
from public.user_cards uc
where m.user_id = uc.user_id
  and uc.code = 'shinhan_corp'
  and m.card_id is null
  and m.sms_confirmed_year is not null
  and m.user_id is not null;

-- SMS 유니크 인덱스: 카드 단위 (구버전 인덱스 제거 후 생성)
drop index if exists public.expenses_user_sms_fingerprint_year_uidx;
drop index if exists public.expenses_user_sms_fingerprint_date_uidx;

create unique index if not exists expenses_user_card_sms_fp_year_uidx
  on public.expenses (user_id, card_id, sms_fingerprint, sms_confirmed_year)
  where sms_fingerprint is not null
    and sms_confirmed_year is not null
    and card_id is not null;

drop index if exists public.expenses_user_sms_semantic_year_uidx;

create unique index if not exists expenses_user_card_sms_semantic_year_uidx
  on public.expenses (user_id, card_id, sms_confirmed_year, sms_semantic_key)
  where sms_semantic_key is not null
    and sms_confirmed_year is not null
    and card_id is not null;

create index if not exists expenses_user_card_date_idx
  on public.expenses (user_id, card_id, date desc);

drop index if exists public.expense_sms_deleted_markers_user_fp_year_uidx;

create unique index if not exists expense_sms_deleted_markers_user_card_fp_year_uidx
  on public.expense_sms_deleted_markers (user_id, card_id, sms_fingerprint, sms_confirmed_year)
  where sms_confirmed_year is not null
    and card_id is not null;

-- user_cards.user_id 변경 금지
create or replace function public.user_cards_prevent_user_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_cards.user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists user_cards_prevent_user_id_change_trigger on public.user_cards;
create trigger user_cards_prevent_user_id_change_trigger
  before update on public.user_cards
  for each row
  execute function public.user_cards_prevent_user_id_change();

-- 계정당 기본 카드 2종 (트리거·RPC 공통)
create or replace function public.seed_default_user_cards(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  -- authenticated 세션에서는 본인 UID만 (다른 사용자 카드 시드 방지)
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'cannot seed cards for another user';
  end if;

  insert into public.user_cards (user_id, code, display_name, issuer, sms_last_digits, sort_order)
  values (p_user_id, 'shinhan_corp', '법인카드', 'shinhan', null, 0)
  on conflict (user_id, code) do nothing;

  insert into public.user_cards (user_id, code, display_name, issuer, sms_last_digits, sort_order)
  values (p_user_id, 'kb_8091', 'KB국민카드', 'kb', '8091', 1)
  on conflict (user_id, code) do nothing;
end;
$$;

revoke all on function public.seed_default_user_cards(uuid) from public;
revoke all on function public.seed_default_user_cards(uuid) from authenticated;
revoke all on function public.seed_default_user_cards(uuid) from anon;

create or replace function public.ensure_user_cards()
returns setof public.user_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  perform public.seed_default_user_cards(v_uid);

  return query
  select *
  from public.user_cards
  where user_id = v_uid
  order by sort_order, display_name;
end;
$$;

revoke all on function public.ensure_user_cards() from public;
grant execute on function public.ensure_user_cards() to authenticated;

-- INSERT expenses: user_id 설정 후 카드 시드·기본값·소유 검증
create or replace function public.expenses_validate_card_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default uuid;
begin
  if new.user_id is null then
    raise exception 'user_id required before card assignment';
  end if;

  perform public.seed_default_user_cards(new.user_id);

  if new.card_id is null then
    select id into v_default
    from public.user_cards
    where user_id = new.user_id and code = 'shinhan_corp'
    limit 1;
    if v_default is null then
      raise exception 'card required';
    end if;
    new.card_id := v_default;
  end if;

  if not exists (
    select 1 from public.user_cards
    where id = new.card_id and user_id = new.user_id
  ) then
    raise exception 'card_id must belong to user';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_validate_card_id_trigger on public.expenses;
create trigger expenses_validate_card_id_trigger
  before insert or update of card_id, user_id on public.expenses
  for each row
  execute function public.expenses_validate_card_id();

-- 삭제 마커: card_id·user_id 소유 일치
create or replace function public.expense_sms_deleted_markers_validate_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or new.card_id is null then
    if new.sms_confirmed_year is not null and new.sms_fingerprint is not null then
      raise exception 'deleted marker requires user_id and card_id';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.user_cards
    where id = new.card_id and user_id = new.user_id
  ) then
    raise exception 'deleted marker card_id must belong to user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists expense_sms_deleted_markers_validate_card_trigger
  on public.expense_sms_deleted_markers;
create trigger expense_sms_deleted_markers_validate_card_trigger
  before insert or update of card_id, user_id on public.expense_sms_deleted_markers
  for each row
  execute function public.expense_sms_deleted_markers_validate_card();

create or replace function public.delete_expense_with_sms_marker(p_expense_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $delete_expense_with_sms_marker$
declare
  v_uid uuid;
  v_deleted public.expenses%rowtype;
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
     and v_deleted.sms_confirmed_year is not null
     and v_deleted.card_id is not null then
    insert into public.expense_sms_deleted_markers (
      user_id,
      card_id,
      sms_fingerprint,
      sms_confirmed_year
    )
    values (
      v_uid,
      v_deleted.card_id,
      v_deleted.sms_fingerprint,
      v_deleted.sms_confirmed_year
    )
    on conflict (user_id, card_id, sms_fingerprint, sms_confirmed_year)
    where sms_confirmed_year is not null and card_id is not null
    do update set deleted_at = now();
  end if;

  return jsonb_build_object('ok', true, 'id', v_deleted.id);
end;
$delete_expense_with_sms_marker$;

revoke all on function public.delete_expense_with_sms_marker(uuid) from public;
grant execute on function public.delete_expense_with_sms_marker(uuid) to authenticated;

alter table public.user_cards enable row level security;

drop policy if exists "user_cards_select_own" on public.user_cards;
drop policy if exists "user_cards_insert_own" on public.user_cards;
drop policy if exists "user_cards_update_own" on public.user_cards;
drop policy if exists "user_cards_delete_own" on public.user_cards;

create policy "user_cards_select_own"
  on public.user_cards for select to authenticated
  using (auth.uid() = user_id);

create policy "user_cards_insert_own"
  on public.user_cards for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user_cards_update_own"
  on public.user_cards for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_cards_delete_own"
  on public.user_cards for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_cards to authenticated;

alter table public.expenses validate constraint expenses_installment_months_check;

commit;