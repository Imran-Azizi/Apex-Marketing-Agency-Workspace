"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  KeyRound,
  LogIn,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeLoginCredentialsFields } from "./employee-login-credentials";
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
  canViewCredentials?: boolean;
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
  canViewCredentials = false,
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
      <DropdownMenuContent align="end" className="w-52">
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
        {canViewCredentials ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer [&>svg:last-child]:rtl:-scale-x-100">
              <LogIn className="me-2 h-4 w-4" />
              اطلاعات ورود
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              align="start"
              sideOffset={8}
              className="w-80 p-3"
            >
              <div
                dir="rtl"
                onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => e.stopPropagation()}
              >
                <p className="mb-2.5 text-sm font-semibold">اطلاعات ورود</p>
                <EmployeeLoginCredentialsFields
                  key={`${employee.id}-${employee.updatedAt}`}
                  employeeId={employee.id}
                  email={employee.email}
                  hasPasswordCipher={Boolean(employee.hasPasswordCipher)}
                  compact
                />
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
