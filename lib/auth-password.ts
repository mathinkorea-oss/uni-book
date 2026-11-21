/** Matches Supabase default minimum (Dashboard → Auth → Providers → Email). */
export const MIN_PASSWORD_LENGTH = 6;

export function validatePasswordPair(
  password: string,
  confirm: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (password !== confirm) {
    return "비밀번호가 일치하지 않습니다.";
  }
  return null;
}