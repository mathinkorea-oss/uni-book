import { LoginNavLink } from "@/components/login/login-nav-link";
import { LoginShell } from "@/components/login/login-shell";

export default function FindIdPage() {
  return (
    <LoginShell title="아이디 찾기" description="유니더노트 로그인 안내">
      <div className="space-y-3 text-sm leading-relaxed text-brand-ink">
        <p>
          로그인 아이디는 <strong className="font-semibold">등록한 이메일 주소</strong>
          입니다.
        </p>
        <p className="text-brand-muted">
          이메일 주소가 기억나지 않으면 운영자에게 문의해 주세요.
        </p>
        <p className="text-xs text-brand-muted">
          이 서비스는 공개 회원가입을 제공하지 않으며, 이름·휴대전화 등으로 이메일을
          조회하는 기능은 보안상 제공하지 않습니다.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 border-t border-brand-border pt-5">
        <LoginNavLink href="/login">로그인으로 돌아가기</LoginNavLink>
      </div>
    </LoginShell>
  );
}