-- 로컬/스테이징 PostgreSQL 수동 검증 (운영 적용 전)
-- 실행: 마이그레이션 적용 후, 테스트 사용자로 auth.uid() 세션에서 각 블록 실행
-- 이 스크립트는 CI에서 자동 실행되지 않음

-- V1) 기본 분류 이름 변경 후 ensure 재실행 → display_name 유지
-- 1) ensure 1회
-- select display_name from user_expense_categories where user_id = auth.uid() and code = 'meal';
-- 2) update user_expense_categories set display_name = '식비' where user_id = auth.uid() and code = 'meal';
-- 3) select ensure_user_expense_categories();
-- 4) select display_name from user_expense_categories where user_id = auth.uid() and code = 'meal';
-- 기대: '식비'

-- V2) 세 가지 대체 이름 선점 후 meal 코드 없을 때 ensure
-- insert custom display names only (custom_ codes), then run ensure
-- 기대: meal 행 생성, display_name은 'meal (기본분류 1)' 이상 충돌 없는 이름

-- V3) 동시 ensure — 두 세션에서 동시 호출
-- 기대: 오류 없음, meal 코드 행 1개만

-- V4) 기본 코드로 사용자 분류 insert 시도
-- insert into user_expense_categories (user_id, code, display_name, sort_order, is_builtin)
-- values (auth.uid(), 'meal', '가짜', 99, false);
-- 기대: CHECK 또는 RLS 또는 트리거로 거부

-- V5) 사용 중지 기본 분류
-- update set is_active = false where code = 'meal';
-- select ensure_user_expense_categories();
-- select is_active from user_expense_categories where code = 'meal';
-- 기대: is_active still false (ensure는 기존 code 행을 UPDATE 하지 않음)