"use client";

import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmCustomer } from "./types";

interface CustomerActionsProps {
  customer: CrmCustomer;
  onEdit: (customer: CrmCustomer) => void;
  onDelete: (customer: CrmCustomer) => void;
}

export function CustomerActions({
  customer,
  onEdit,
  onDelete,
}: CustomerActionsProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="عملیات"
          aria-label="عملیات"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>عملیات</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/crm/${customer.id}`)}
        >
          <Eye className="me-2 h-4 w-4" />
          مشاهده جزئیات
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onEdit(customer)}
        >
          <Pencil className="me-2 h-4 w-4" />
          ویرایش
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => onDelete(customer)}
        >
          <Trash2 className="me-2 h-4 w-4" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
