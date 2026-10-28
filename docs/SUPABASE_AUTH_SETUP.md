# UNITHE 법카노트 — Supabase Auth 적용 순서

에이전트는 로컬 코드만 수정합니다. **SQL은 Supabase Dashboard에서 KiJong이 직접 실행**해야 하며, 실행 전까지 DB 적용 완료로 보지 마세요.

## 실행 순서 (요약)

1. **Auth 마이그레이션** — `20260328100000` (필요 시) → `20260328120000_auth_user_rls.sql`
2. **관리자용 기존 기록 연결** — `supabase/scripts/link_legacy_expenses.sql` (UUID 1곳만 수정)
3. **정책 확인** — `supabase/scripts/audit_expenses_policies.sql`
4. **앱 테스트** — 로컬 `npm run dev` / 배포 환경

---

## 0. 사전 준비

- **Authentication → Providers → Email** 로그인 ON
- 공개 회원가입 불필요 시 **Authentication → Settings** 에서 *Enable email signups* OFF
- **Authentication → Users → Add user** 로 원장 계정 생성 후 **User UID (UUID)** 복사

앱에는 회원가입 화면이 없습니다. `/login` 에서만 로그인합니다.

---

## 1. Auth 마이그레이션

SQL Editor에서 **아직 적용하지 않았다면** 순서대로 실행합니다.

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `supabase/migrations/20260328100000_expense_categories_sort.sql` | 분류·정렬 컬럼 |
| 2 | `supabase/migrations/20260328120000_auth_user_rls.sql` | `user_id`, RLS, 트리거, `reorder_expenses_batch` |

`20260328120000` 적용 후:

- `expenses.user_id` 컬럼 존재 (NULL 허용)
- `expenses_prevent_user_id_change_trigger` — **앱에서 `user_id` 변경 불가**
- `reorder_expenses_batch` — `returns jsonb`; 기존 `void` 함수는 파일 안 `begin`…`commit` 블록에서 **DROP 후 재생성** (CASCADE 없음)
- reorder: 비로그인 거부, **중복 ID**·`sort_order` 누락/비정수 거부, 타인·없는 ID는 **0건 갱신 시 예외**
- `anon` 에 reorder 실행 권한 없음

**이미 예전 `void` 버전의 `reorder_expenses_batch` 가 있다면**, 마이그레이션 파일 하단의 `begin` … `commit` 블록(reorder DROP·CREATE·REVOKE·GRANT)만 SQL Editor에서 다시 실행하세요.

---

## 2. 관리자용 기존 기록 연결 SQL

`user_id` 가 **NULL** 인 행은 로그인 후 목록에 **나타나지 않습니다** (첫 로그인 자동 배정 없음).

일반 `UPDATE` 만으로는 `expenses_prevent_user_id_change_trigger` 때문에 `user_id` 를 바꿀 수 없습니다.  
**관리자만** SQL Editor에서 아래 스크립트 전체를 실행합니다. RLS 는 끄지 않고, **소유자 변경 방지 트리거만** 잠시 비활성화합니다.

**파일:** `supabase/scripts/link_legacy_expenses.sql`

### UUID 입력 위치 (이 한 곳만 수정)

스크립트 안에서 다음 줄의 `PASTE_YOUR_UUID_HERE` 를 Authentication → Users 에서 복사한 UUID 로 바꿉니다.

```sql
insert into _uni_link_legacy (target_user)
values (
  'PASTE_YOUR_UUID_HERE'::uuid   -- ← 여기만 수정
);
```

스크립트 실행 순서 (파일 전체를 한 번에 실행):

1. `begin` — 트랜잭션 시작
2. `_uni_link_legacy` 에 **UUID 1곳** 입력
3. `auth.users` 존재 확인 (실패 시 **롤백**)
4. 연결 전 건수 조회 (`rows_to_link`, `rows_already_owned`)
5. `expenses_prevent_user_id_change_trigger` **DISABLE** (RLS·INSERT 트리거는 유지)
6. `user_id IS NULL` 행만 **UPDATE** → `linked_row_count` 표시
7. 트리거 **ENABLE**
8. 연결 후 건수 조회 → `commit`

**다른 소유자(`user_id` 가 이미 있는) 행은 변경하지 않습니다.**  
`ALTER … DISABLE TRIGGER` 는 트랜잭션에 포함되므로 오류 시 `rollback` 으로 트리거 상태도 복구됩니다.

---

## 3. 정책 확인

마이그레이션의 `drop policy if exists` 목록과 Dashboard에 있는 정책 **이름이 다르면** 예전 `anon` / `true` 허용 정책이 남을 수 있습니다.

**읽기 전용 조회:** `supabase/scripts/audit_expenses_policies.sql`

SQL Editor에서 실행한 뒤 **3개 결과 집합**을 확인합니다.

| 질의 | 확인 항목 | 기대 |
|------|-----------|------|
| 1) 전체 목록 | 정책 이름 | `expenses_*_own` 4개 |
| 1) | `roles` | `{authenticated}` |
| 2) 광범위 후보 | 행 수 | **0건** (있으면 `audit_flag` 보고 삭제) |
| 2) | `anon` / `true` | 후보 목록에 없어야 함 |
| 3) RLS | `rls_enabled` | `true` |

남아 있는 광범위 정책은 Dashboard → **Authentication → Policies** → `expenses` 에서 삭제하거나, 동일 조건의 정책을 직접 정리합니다.

---

## 4. 앱 테스트

프로젝트 **루트** `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `GEMINI_API_KEY` (서버 전용, `NEXT_PUBLIC_` 금지)

```bash
npm install
npm run dev
```

### 검증 체크리스트

| 항목 | 기대 동작 |
|------|-----------|
| 로그아웃 | `/` → `/login`, 내역 조회 불가 |
| 로그인 | **link SQL 실행 후** 연결된 기존 기록 조회 |
| 수정 | 저장 후 새로고침해도 유지 |
| 삭제 취소 | 목록 유지 |
| 삭제 확인 | 1건 삭제, 합계·건수·필터 갱신 |
| 타 사용자 데이터 | 수정·삭제·정렬 거부 |
| reorder | 비로그인·타인 ID → API/DB 오류, 성공 아님 |
| 모바일 | 드래그는 ≡ 핸들, 수정·삭제 44×44px |

---

## 5. 배포 (Vercel 등)

프로덕션에 동일 Supabase env 설정 후 로그인·RLS·link 결과를 한 번 더 확인합니다.
