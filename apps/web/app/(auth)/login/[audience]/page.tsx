import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InternalLoginView } from "@/components/auth/internal-login-view";
import {
  INTERNAL_AUTH_AUDIENCES,
  getAuthAudienceCopy,
  isInternalAuthAudience,
} from "@/components/auth/auth-audience";

type Props = { params: Promise<{ audience: string }> };

export function generateStaticParams() {
  return INTERNAL_AUTH_AUDIENCES.map((audience) => ({ audience }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { audience } = await params;
  if (!isInternalAuthAudience(audience)) {
    return { title: "ورود — اپیکس" };
  }
  return { title: getAuthAudienceCopy(audience).documentTitle };
}

export default async function RoleLoginPage({ params }: Props) {
  const { audience } = await params;
  if (!isInternalAuthAudience(audience)) notFound();
  return <InternalLoginView audience={audience} />;
}
