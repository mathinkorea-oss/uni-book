import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase 환경 변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 API 키를 설정해 주세요.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type ExpenseRow = {
  id: string;
  created_at: string;
  date: string;
  amount: number;
  description: string;
};
