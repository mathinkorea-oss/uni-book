-- SMS 중복 방지 스키마 점검 (읽기 전용)
-- 마이그레이션 전후 모두 실행 가능. 없는 객체는 "미적용"으로 표시.

create temp table _sms_audit (
  section text not null,
  check_id text not null,
  status text not null,
  detail text
) on commit drop;

-- 1) expenses 인덱스 (컬럼 불필요)
insert into _sms_audit (section, check_id, status, detail)
select
  'indexes',
  'expenses_date_uidx_legacy',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expenses'
      and indexname = 'expenses_user_sms_fingerprint_date_uidx'
  ) then '주의' else 'ok' end,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expenses'
      and indexname = 'expenses_user_sms_fingerprint_date_uidx'
  )
    then '구 date 기준 인덱스가 남아 있음. 마이그레이션에서 drop 예정'
    else '구 date 기준 인덱스 없음'
  end;

insert into _sms_audit (section, check_id, status, detail)
select
  'indexes',
  'expenses_year_uidx',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expenses'
      and indexname = 'expenses_user_sms_fingerprint_year_uidx'
  ) then 'ok' else '미적용' end,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expenses'
      and indexname = 'expenses_user_sms_fingerprint_year_uidx'
  )
    then '확인 연도 기준 유니크 인덱스 존재'
    else 'SMS 마이그레이션 미적용 또는 인덱스 미생성'
  end;

-- 2) expenses SMS 컬럼
insert into _sms_audit (section, check_id, status, detail)
select
  'expenses_columns',
  c.column_name,
  'ok',
  c.data_type || ', nullable=' || c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'expenses'
  and c.column_name in ('sms_fingerprint', 'sms_confirmed_year', 'payment_time');

insert into _sms_audit (section, check_id, status, detail)
select
  'expenses_columns',
  v.col,
  '미적용',
  '컬럼 없음. SMS 마이그레이션 미적용'
from (
  values
    ('sms_fingerprint'),
    ('sms_confirmed_year'),
    ('payment_time')
) as v(col)
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'expenses'
    and c.column_name = v.col
);

-- 3) expenses_sms_pair_check
do $audit$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'sms_fingerprint'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'sms_confirmed_year'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'constraints',
      'expenses_sms_pair_check',
      '미적용',
      'sms_fingerprint 또는 sms_confirmed_year 컬럼 없음'
    );
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_sms_pair_check'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'constraints',
      'expenses_sms_pair_check',
      '미적용',
      'CHECK 제약 없음. SMS 마이그레이션 미적용'
    );
  else
    insert into _sms_audit (section, check_id, status, detail)
    select
      'constraints',
      'expenses_sms_pair_check',
      case when c.convalidated then 'ok' else '주의' end,
      pg_get_constraintdef(c.oid)
    from pg_constraint c
    where c.conrelid = 'public.expenses'::regclass
      and c.conname = 'expenses_sms_pair_check';
  end if;
end;
$audit$;

-- 4) expenses SMS 데이터 이슈 (동적 SQL)
do $audit$
declare
  v_inserted bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'sms_fingerprint'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'sms_confirmed_year'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'expenses_data',
      'sms_pair_issues',
      '미적용',
      'SMS 컬럼 없어 데이터 점검 생략'
    );
    return;
  end if;

  execute $sql$
    insert into _sms_audit (section, check_id, status, detail)
    select
      'expenses_data',
      'row_' || id::text,
      '주의',
      'issue=' || issue
        || ', date=' || date::text
        || ', user_id=' || user_id::text
    from (
      select
        id,
        user_id,
        date,
        case
          when sms_fingerprint is not null and sms_confirmed_year is null
            then 'fingerprint_only'
          when sms_fingerprint is null and sms_confirmed_year is not null
            then 'year_only'
          when sms_fingerprint is not null
            and sms_fingerprint !~ '^[a-f0-9]{64}$'
            then 'invalid_fingerprint_format'
          when sms_confirmed_year is not null
            and (sms_confirmed_year < 2000 or sms_confirmed_year > 2100)
            then 'invalid_confirmed_year'
          else 'ok'
        end as issue
      from public.expenses
      where
        (sms_fingerprint is null) <> (sms_confirmed_year is null)
        or (
          sms_fingerprint is not null
          and sms_fingerprint !~ '^[a-f0-9]{64}$'
        )
        or (
          sms_confirmed_year is not null
          and (sms_confirmed_year < 2000 or sms_confirmed_year > 2100)
        )
    ) t
    where issue <> 'ok'
  $sql$;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'expenses_data',
      'sms_pair_issues',
      'ok',
      '불일치·형식 오류 행 없음'
    );
  end if;
exception
  when others then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'expenses_data',
      'sms_pair_issues',
      '오류',
      sqlerrm
    );
end;
$audit$;

-- 5) 삭제 마커 테이블 존재·컬럼
insert into _sms_audit (section, check_id, status, detail)
select
  'markers_table',
  'exists',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
  ) then 'ok' else '미적용' end,
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
  )
    then 'expense_sms_deleted_markers 테이블 존재'
    else '테이블 없음. SMS 마이그레이션 미적용'
  end;

insert into _sms_audit (section, check_id, status, detail)
select
  'markers_columns',
  c.column_name,
  'ok',
  c.data_type || ', nullable=' || c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'expense_sms_deleted_markers';

insert into _sms_audit (section, check_id, status, detail)
select
  'markers_columns',
  'table',
  '미적용',
  '마커 테이블 없음'
where not exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'expense_sms_deleted_markers'
);

-- 6) 레거시 마커 행 (동적)
do $audit$
declare
  v_has_table boolean;
  v_has_fp boolean;
  v_has_year boolean;
  v_has_edate boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
  ) into v_has_table;

  if not v_has_table then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_legacy_rows',
      'unmigrated',
      '미적용',
      '마커 테이블 없음'
    );
    return;
  end if;

  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'expense_sms_deleted_markers'
        and column_name = 'sms_fingerprint'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'expense_sms_deleted_markers'
        and column_name = 'sms_confirmed_year'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'expense_sms_deleted_markers'
        and column_name = 'expense_date'
    )
  into v_has_fp, v_has_year, v_has_edate;

  if not v_has_fp then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_legacy_rows',
      'unmigrated',
      '미적용',
      'sms_fingerprint 컬럼 없음 (구 스키마 아님 또는 미완료)'
    );
    return;
  end if;

  if v_has_year and v_has_edate then
    execute $sql$
      insert into _sms_audit (section, check_id, status, detail)
      select
        'markers_legacy_rows',
        'row_' || user_id::text || '_' || left(sms_fingerprint, 8),
        '주의',
        'expense_date=' || expense_date::text
          || ', sms_confirmed_year=null'
          || ' — 확인 연도 자동 추정 불가, 수동 검토'
      from public.expense_sms_deleted_markers
      where sms_confirmed_year is null
        and expense_date is not null
    $sql$;
  elsif v_has_year then
    execute $sql$
      insert into _sms_audit (section, check_id, status, detail)
      select
        'markers_legacy_rows',
        'row_' || user_id::text,
        '주의',
        'sms_confirmed_year=null — 마이그레이션 전 구 행 가능'
      from public.expense_sms_deleted_markers
      where sms_confirmed_year is null
    $sql$;
  else
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_legacy_rows',
      'unmigrated',
      '미적용',
      'sms_confirmed_year 컬럼 없음'
    );
    return;
  end if;

  if not exists (
    select 1 from _sms_audit
    where section = 'markers_legacy_rows'
      and check_id like 'row_%'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_legacy_rows',
      'unmigrated',
      'ok',
      '확인 연도 없는 구 마커 행 없음'
    );
  end if;
end;
$audit$;

-- 7) 레거시 PK vs 연도 partial unique 충돌 가능성 (안내만, 데이터 변경 없음)
do $audit$
declare
  v_has_table boolean;
  v_pk_cols text;
  v_has_year_idx boolean;
  v_has_edate_in_pk boolean;
  v_has_year_in_pk boolean;
  v_has_edate boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
  ) into v_has_table;

  if not v_has_table then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_pk_conflict',
      'schema_mode',
      '미적용',
      '마커 테이블 없음'
    );
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
      and column_name = 'expense_date'
  ) into v_has_edate;

  select string_agg(a.attname, ', ' order by u.ord)
  into v_pk_cols
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join lateral unnest(c.conkey) with ordinality as u(attnum, ord) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = u.attnum
  where n.nspname = 'public'
    and t.relname = 'expense_sms_deleted_markers'
    and c.contype = 'p';

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expense_sms_deleted_markers'
      and indexname = 'expense_sms_deleted_markers_user_fp_year_uidx'
  ) into v_has_year_idx;

  v_has_edate_in_pk := v_pk_cols is not null and v_pk_cols like '%expense_date%';
  v_has_year_in_pk := v_pk_cols is not null and v_pk_cols like '%sms_confirmed_year%';

  if v_has_year_in_pk and not v_has_edate_in_pk then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_pk_conflict',
      'schema_mode',
      'ok',
      'greenfield: PK=' || coalesce(v_pk_cols, '(none)')
        || ', partial year index=' || v_has_year_idx::text
    );
  elsif v_has_edate_in_pk and not v_has_year_in_pk then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_pk_conflict',
      'schema_mode',
      '주의',
      'legacy_date_pk: PK=' || v_pk_cols
        || '. expense_date 축과 sms_confirmed_year partial unique('
        || v_has_year_idx::text
        || ')가 공존. 동일 user+fingerprint에 date PK 행과 year 인덱스 행이 '
        || '서로 다른 키로 공존할 수 있음. 구 행의 sms_confirmed_year=null은 '
        || '연도 추정 없이 자동 전환 불가. 신규 삭제는 지출 date+confirmed_year로 insert.'
    );
  elsif v_has_edate_in_pk and v_has_year_in_pk then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_pk_conflict',
      'schema_mode',
      '주의',
      '혼합 PK=' || v_pk_cols || ' — 수동 검토 권장'
    );
  else
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_pk_conflict',
      'schema_mode',
      '주의',
      'PK=' || coalesce(v_pk_cols, '없음')
        || ', year partial index=' || v_has_year_idx::text
    );
  end if;

  if v_has_edate_in_pk
     and v_has_edate
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'expense_sms_deleted_markers'
         and column_name = 'sms_fingerprint'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'expense_sms_deleted_markers'
         and column_name = 'sms_confirmed_year'
     )
  then
    execute $sql$
      insert into _sms_audit (section, check_id, status, detail)
      select
        'markers_pk_conflict',
        'dup_user_fp',
        '주의',
        'user_id=' || user_id::text
          || ', fingerprint=' || left(sms_fingerprint, 12)
          || ' — expense_date distinct count=' || count(distinct expense_date)::text
          || '. 여러 date PK 행 존재 시 year upsert와 별도 축'
      from public.expense_sms_deleted_markers
      where expense_date is not null
      group by user_id, sms_fingerprint
      having count(distinct expense_date) > 1
    $sql$;
  end if;
end;
$audit$;

-- 8) 마커 partial year index
insert into _sms_audit (section, check_id, status, detail)
select
  'markers_indexes',
  'user_fp_year_uidx',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'expense_sms_deleted_markers'
      and indexname = 'expense_sms_deleted_markers_user_fp_year_uidx'
  ) then 'ok' else '미적용' end,
  'ON CONFLICT (user_id, sms_fingerprint, sms_confirmed_year) '
    || 'WHERE sms_confirmed_year IS NOT NULL 대상 인덱스';

-- 9) RLS·GRANT (테이블 있을 때만)
do $audit$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'expense_sms_deleted_markers'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_rls',
      'policies',
      '미적용',
      '테이블 없음'
    );
    return;
  end if;

  insert into _sms_audit (section, check_id, status, detail)
  select
    'markers_rls',
    policyname,
    case when cmd = 'UPDATE' then
      case when qual like '%auth.uid()%' and with_check like '%auth.uid()%' then 'ok' else '주의' end
    else 'ok' end,
    'cmd=' || cmd
  from pg_policies
  where schemaname = 'public'
    and tablename = 'expense_sms_deleted_markers';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expense_sms_deleted_markers'
      and policyname = 'sms_deleted_markers_update_own'
  ) then
    insert into _sms_audit (section, check_id, status, detail)
    values (
      'markers_rls',
      'sms_deleted_markers_update_own',
      '미적용',
      'UPDATE RLS 없음 — ON CONFLICT DO UPDATE 실패 가능'
    );
  end if;

  insert into _sms_audit (section, check_id, status, detail)
  select
    'markers_grants',
    privilege_type,
    'ok',
    'grantee=authenticated'
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'expense_sms_deleted_markers'
    and grantee = 'authenticated';
end;
$audit$;

-- 10) delete 함수
insert into _sms_audit (section, check_id, status, detail)
select
  'functions',
  'delete_expense_with_sms_marker',
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'delete_expense_with_sms_marker'
  ) then 'ok' else '미적용' end,
  'security invoker, auth.uid() 필수';

-- 11) NOT VALID 제약
insert into _sms_audit (section, check_id, status, detail)
select
  'constraints',
  c.conname,
  case when c.convalidated then 'ok' else '주의' end,
  'NOT VALID — validate 전 데이터 정리 필요'
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and not c.convalidated
  and c.conname in (
    'expenses_sms_pair_check',
    'expense_sms_deleted_markers_fingerprint_check',
    'expense_sms_deleted_markers_year_check'
  );

-- 결과
select section, check_id, status, detail
from _sms_audit
order by section, check_id;

-- 마이그레이션 후 이슈 없을 때만 수동 실행:
-- alter table public.expenses validate constraint expenses_sms_pair_check;
-- alter table public.expense_sms_deleted_markers validate constraint expense_sms_deleted_markers_fingerprint_check;
-- alter table public.expense_sms_deleted_markers validate constraint expense_sms_deleted_markers_year_check;
