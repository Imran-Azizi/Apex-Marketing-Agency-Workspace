import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { AuthThemeChrome } from "@/components/layout/auth-theme-chrome";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PortalLoginPage() {
  return (
    <AuthThemeChrome>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-foreground">
            ا
          </div>
          <CardTitle>پورتال مشتری</CardTitle>
          <CardDescription>
            ورود مشتریان اپیکس با شماره واتساپ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PortalLoginForm />
        </CardContent>
      </Card>
    </AuthThemeChrome>
  );
}
