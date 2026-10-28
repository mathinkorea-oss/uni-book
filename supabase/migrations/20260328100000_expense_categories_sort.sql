-- UNITHE 법카노트: 분류·정렬·메모 필드
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.expenses
  add column if not exists note text not null default '',
  add column if not exists category_code text not null default 'other',
  add column if not exists category_needs_review boolean not null default false,
  add column if not exists category_user_set boolean not null default false,
  add column if not exists sort_order integer;

comment on column public.expenses.category_code is '내부 분류 코드 (화면 라벨과 분리)';
comment on column public.expenses.sort_order is '월별 직접 정렬 순서 (작을수록 위)';

create index if not exists expenses_date_sort_idx
  on public.expenses (date desc, sort_order asc nulls last);

-- RLS: update가 없으면 수정·정렬이 실패합니다. (anon 예시 — 운영 환경에 맞게 조정)
-- create policy "Allow public update" on public.expenses for update to anon using (true) with check (true);

create or replace function public.reorder_expenses_batch(updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row jsonb;
begin
  if updates is null or jsonb_typeof(updates) <> 'array' then
    raise exception 'updates must be a json array';
  end if;
  for row in select * from jsonb_array_elements(updates)
  loop
    update public.expenses
    set sort_order = (row->>'sort_order')::integer
    where id = (row->>'id')::uuid;
  end loop;
end;
$$;

grant execute on function public.reorder_expenses_batch(jsonb) to anon, authenticated;
