import type { Metadata } from "next";
import Link from "next/link";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AUTH_AUDIENCE_COPY } from "@/components/auth/auth-audience";

export const metadata: Metadata = {
  title: AUTH_AUDIENCE_COPY.portal.documentTitle,
};

export default function PortalLoginPage() {
  return (
    <AuthShell
      audience="portal"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          عضو تیم اپیکس هستید؟{" "}
          <Link
            href="/login"
            className="font-medium text-brand transition-colors hover:text-brand/80 hover:underline underline-offset-4"
          >
            ورود تیم
          </Link>
        </p>
      }
    >
      <PortalLoginForm />
    </AuthShell>
  );
}
