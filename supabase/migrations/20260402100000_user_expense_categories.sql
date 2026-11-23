-- 사용자별 분류 표시 이름·순서·사용 중지 (category_code 값은 변경하지 않음)
-- 기본 분류 행은 마이그레이션 직후가 아니라 로그인 후 ensure_user_expense_categories() 호출 시 생성됩니다.
-- 사용자 추가 분류 code는 custom_ 접두사만 허용 (기본 코드 선점 방지)

begin;

create table if not exists public.user_expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  display_name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint user_expense_categories_code_check check (code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint user_expense_categories_name_nonempty check (char_length(trim(display_name)) > 0),
  constraint user_expense_categories_builtin_or_custom_code check (
    is_builtin
    or (code ~ '^custom_[a-z0-9_]{4,63}$')
  )
);

create unique index if not exists user_expense_categories_user_code_uidx
  on public.user_expense_categories (user_id, code);

create unique index if not exists user_expense_categories_user_name_ci_uidx
  on public.user_expense_categories (user_id, lower(trim(display_name)));

comment on table public.user_expense_categories is '계정별 지출 분류 표시·순서 (expenses.category_code와 code로 연결)';
comment on column public.user_expense_categories.is_builtin is '앱 기본 분류 코드 여부 (사용자 추가는 false)';
comment on column public.user_expense_categories.is_active is 'false면 신규 입력 선택 목록에서 제외, 기존 기록·통계 유지';

alter table public.user_expense_categories enable row level security;

create policy user_expense_categories_select_own
  on public.user_expense_categories
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_expense_categories_insert_own
  on public.user_expense_categories
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_builtin = false
    and code ~ '^custom_[a-z0-9_]{4,63}$'
  );

create policy user_expense_categories_update_own
  on public.user_expense_categories
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_expense_categories_delete_own
  on public.user_expense_categories
  for delete
  to authenticated
  using (user_id = auth.uid() and is_builtin = false);

create or replace function public.trg_user_expense_categories_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_expense_categories.user_id cannot be changed';
    end if;
    if new.code is distinct from old.code then
      raise exception 'user_expense_categories.code cannot be changed';
    end if;
    if new.is_builtin is distinct from old.is_builtin then
      raise exception 'user_expense_categories.is_builtin cannot be changed';
    end if;
  end if;
  if tg_op = 'INSERT' and new.is_builtin = false then
    if new.code !~ '^custom_[a-z0-9_]{4,63}$' then
      raise exception 'user_expense_categories.user code must use custom_ prefix';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_expense_categories_guard on public.user_expense_categories;

create trigger user_expense_categories_guard
  before insert or update on public.user_expense_categories
  for each row
  execute function public.trg_user_expense_categories_guard();

create or replace function public.pick_builtin_seed_display_name(
  p_user_id uuid,
  p_default_name text,
  p_code text,
  p_name_offset integer default 0
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  attempt integer;
  candidate text;
  base_attempt integer;
begin
  for attempt in 1 + p_name_offset..128 loop
    base_attempt := attempt;
    if base_attempt = 1 then
      candidate := p_default_name;
    elsif base_attempt = 2 then
      candidate := p_default_name || ' · 기본';
    elsif base_attempt = 3 then
      candidate := p_code || ' (기본분류)';
    else
      candidate := p_code || ' (기본분류 ' || (base_attempt - 3)::text || ')';
    end if;

    if not exists (
      select 1
      from public.user_expense_categories
      where user_id = p_user_id
        and lower(trim(display_name)) = lower(trim(candidate))
    ) then
      return candidate;
    end if;
  end loop;

  return p_code || '_기본_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
end;
$$;

revoke all on function public.pick_builtin_seed_display_name(uuid, text, text, integer) from public;
revoke all on function public.pick_builtin_seed_display_name(uuid, text, text, integer) from anon;
revoke all on function public.pick_builtin_seed_display_name(uuid, text, text, integer) from authenticated;

create or replace function public.seed_default_user_expense_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  builtin record;
  insert_name text;
  retry integer;
  name_offset integer;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'unauthorized';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  for builtin in
    select * from (
      values
        ('meal', '식사', 0),
        ('student_snack', '학생간식', 1),
        ('books_stationery', '도서·문구', 2),
        ('math_tools', '수학 학습도구', 3),
        ('academy_supplies', '학원비품', 4),
        ('promotion', '홍보', 5),
        ('instructor_hiring', '강사 구인', 6),
        ('ai_service', 'AI 서비스', 7),
        ('transport', '교통·차량', 8),
        ('golf', '골프', 9),
        ('travel', '여행', 10),
        ('hospital', '병원', 11),
        ('pharmacy', '약국', 12),
        ('entertainment', '접대', 13),
        ('gathering', '회식', 14),
        ('gift', '선물', 15),
        ('personal_items', '개인물품', 16),
        ('other', '기타', 17)
    ) as t(code, display_name, sort_order)
  loop
    if exists (
      select 1
      from public.user_expense_categories
      where user_id = p_user_id and code = builtin.code
    ) then
      continue;
    end if;

    name_offset := 0;
    for retry in 1..12 loop
      if exists (
        select 1
        from public.user_expense_categories
        where user_id = p_user_id and code = builtin.code
      ) then
        exit;
      end if;

      insert_name := public.pick_builtin_seed_display_name(
        p_user_id,
        builtin.display_name,
        builtin.code,
        name_offset
      );

      begin
        insert into public.user_expense_categories (
          user_id, code, display_name, sort_order, is_active, is_builtin
        )
        values (
          p_user_id,
          builtin.code,
          insert_name,
          builtin.sort_order,
          true,
          true
        );
        exit;
      exception
        when unique_violation then
          if exists (
            select 1
            from public.user_expense_categories
            where user_id = p_user_id and code = builtin.code
          ) then
            exit;
          end if;
          name_offset := name_offset + 1;
      end;
    end loop;

    if not exists (
      select 1
      from public.user_expense_categories
      where user_id = p_user_id and code = builtin.code
    ) then
      raise exception
        'seed_default_user_expense_categories: builtin code % not created for user % after 12 insert attempts',
        builtin.code,
        p_user_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.seed_default_user_expense_categories(uuid) from public;
revoke all on function public.seed_default_user_expense_categories(uuid) from anon;

create or replace function public.ensure_user_expense_categories()
returns setof public.user_expense_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform public.seed_default_user_expense_categories(uid);
  return query
    select *
    from public.user_expense_categories
    where user_id = uid
    order by sort_order asc, display_name asc;
end;
$$;

revoke all on function public.ensure_user_expense_categories() from public;
revoke all on function public.ensure_user_expense_categories() from anon;
grant execute on function public.ensure_user_expense_categories() to authenticated;
grant execute on function public.seed_default_user_expense_categories(uuid) to authenticated;

grant select, insert, update, delete on public.user_expense_categories to authenticated;

commit;