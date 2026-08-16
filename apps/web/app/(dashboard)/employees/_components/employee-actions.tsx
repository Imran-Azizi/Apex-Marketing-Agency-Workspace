"use client";

import { useRouter } from "next/navigation";
import {
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Employee } from "./types";

interface EmployeeActionsProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
  onResetPassword: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  canEdit?: boolean;
  canDisable?: boolean;
  canDelete?: boolean;
}

export function EmployeeActions({
  employee,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
  canEdit = true,
  canDisable = true,
  canDelete = true,
}: EmployeeActionsProps) {
  const router = useRouter();
  const isManagerRole =
    employee.role.code === "MANAGER" || employee.role.code === "ADMIN";

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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>عملیات</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/employees/${employee.id}`)}
        >
          <Eye className="me-2 h-4 w-4" />
          مشاهده پروفایل
        </DropdownMenuItem>
        {!isManagerRole && canEdit && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onEdit(employee)}
          >
            <Pencil className="me-2 h-4 w-4" />
            ویرایش کارمند
          </DropdownMenuItem>
        )}
        {canDisable ? (
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onToggleStatus(employee)}
        >
          {employee.isActive ? (
            <>
              <UserX className="me-2 h-4 w-4" />
              غیرفعال‌سازی
            </>
          ) : (
            <>
              <UserCheck className="me-2 h-4 w-4" />
              فعال‌سازی
            </>
          )}
        </DropdownMenuItem>
        ) : null}
        {canEdit ? (
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onResetPassword(employee)}
        >
          <KeyRound className="me-2 h-4 w-4" />
          بازنشانی رمز عبور
        </DropdownMenuItem>
        ) : null}
        {!isManagerRole && canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => onDelete(employee)}
            >
              <Trash2 className="me-2 h-4 w-4" />
              حذف کارمند
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
