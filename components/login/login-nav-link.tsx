import Link from "next/link";
import type { ReactNode } from "react";

type LoginNavLinkProps = {
  href: string;
  children: ReactNode;
};

export function LoginNavLink({ href, children }: LoginNavLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-brand-green underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}