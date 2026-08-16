import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import type { AuthAudience } from "@/components/auth/auth-audience";

export function InternalLoginView({ audience }: { audience: AuthAudience }) {
  return (
    <AuthShell
      audience={audience}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          مشتری هستید؟{" "}
          <Link
            href="/portal/login"
            className="font-medium text-brand transition-colors hover:text-brand/80 hover:underline underline-offset-4"
          >
            ورود به پورتال
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
