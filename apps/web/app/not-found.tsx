import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">صفحه یافت نشد</p>
      <Button asChild variant="brand">
        <Link href="/">خانه</Link>
      </Button>
    </div>
  );
}
