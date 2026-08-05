"use client";

import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CREATE_PROJECT_DENIED_MESSAGE } from "@/lib/portal";
import { cn } from "@/lib/utils";

type CreateProjectButtonProps = {
  canCreate: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "brand" | "outline" | "default";
};

export function CreateProjectButton({
  canCreate,
  className,
  size = "default",
  variant = "brand",
}: CreateProjectButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (!canCreate) {
      toast.error(CREATE_PROJECT_DENIED_MESSAGE, { duration: 5000 });
      return;
    }
    router.push("/portal/brief");
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(!canCreate && "opacity-70", className)}
      onClick={handleClick}
      aria-disabled={!canCreate}
    >
      <PlusCircle className="h-4 w-4" />
      ایجاد پروژه جدید
    </Button>
  );
}
