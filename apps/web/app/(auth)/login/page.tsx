import type { Metadata } from "next";
import { InternalLoginView } from "@/components/auth/internal-login-view";
import { AUTH_AUDIENCE_COPY } from "@/components/auth/auth-audience";

export const metadata: Metadata = {
  title: AUTH_AUDIENCE_COPY.team.documentTitle,
};

export default function LoginPage() {
  return <InternalLoginView audience="team" />;
}
