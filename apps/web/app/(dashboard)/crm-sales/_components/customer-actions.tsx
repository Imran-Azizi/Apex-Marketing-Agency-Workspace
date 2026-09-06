"use client";

import {
  CheckCircle2,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { crmSalesText } from "./copy";
import { useCustomerTransfer } from "./use-customer-transfer";
import type { CrmCustomer } from "./types";

interface CustomerActionsProps {
  customer: CrmCustomer;
  onEdit: (customer: CrmCustomer) => void;
  onDelete: (customer: CrmCustomer) => void;
  onCreateInvoice?: (customer: CrmCustomer) => void;
  onViewInvoices?: (customer: CrmCustomer) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canInvoice?: boolean;
  canTransfer?: boolean;
}

const itemClass =
  "cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm focus:bg-accent/80";

export function CustomerActions({
  customer,
  onEdit,
  onDelete,
  onCreateInvoice,
  onViewInvoices,
  canEdit = true,
  canDelete = true,
  canInvoice = false,
  canTransfer = false,
}: CustomerActionsProps) {
  const invoiceAllowed =
    canInvoice && customer.allowedActions?.createInvoice !== false;
  const canViewInvoices = canInvoice || customer.allowedActions?.viewInvoice;
  const {
    alreadySent,
    allowed: transferAllowed,
    transferHint,
    transferLabel,
    isPending: transferPending,
    transfer,
  } = useCustomerTransfer(customer, canTransfer);

  const hasWorkflowActions = canInvoice || canTransfer || canViewInvoices;
  const hasMaintenanceActions = canEdit || canDelete;

  if (!hasWorkflowActions && !hasMaintenanceActions) return null;

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
            title={crmSalesText("actions")}
            aria-label={crmSalesText("actions")}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-52 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1.5 shadow-lg backdrop-blur-sm"
        >
          {canInvoice ? (
            <DropdownMenuItem
              className={itemClass}
              disabled={!invoiceAllowed}
              title={
                !invoiceAllowed
                  ? crmSalesText("invoiceClosed")
                  : crmSalesText("createInvoice")
              }
              onClick={() => {
                if (!invoiceAllowed) return;
                onCreateInvoice?.(customer);
              }}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{crmSalesText("createInvoice")}</span>
            </DropdownMenuItem>
          ) : null}

          {canViewInvoices ? (
            <DropdownMenuItem
              className={itemClass}
              onClick={() => onViewInvoices?.(customer)}
            >
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{crmSalesText("viewInvoices")}</span>
            </DropdownMenuItem>
          ) : null}

          {canTransfer ? (
            <DropdownMenuItem
              className={cn(
                itemClass,
                alreadySent && "text-muted-foreground",
              )}
              disabled={!transferAllowed || transferPending}
              title={transferHint}
              onClick={() => {
                if (!transferAllowed || transferPending) return;
                transfer();
              }}
            >
              {alreadySent ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
              ) : (
                <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{transferLabel}</span>
            </DropdownMenuItem>
          ) : null}

          {hasWorkflowActions && hasMaintenanceActions ? (
            <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/60" />
          ) : null}

          {canEdit ? (
            <DropdownMenuItem
              className={itemClass}
              onClick={() => onEdit(customer)}
            >
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>ویرایش</span>
            </DropdownMenuItem>
          ) : null}

          {canDelete ? (
            <>
              {canEdit ? (
                <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/60" />
              ) : null}
              <DropdownMenuItem
                className={cn(
                  itemClass,
                  "text-destructive focus:bg-destructive/10 focus:text-destructive",
                )}
                onClick={() => onDelete(customer)}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span>حذف</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
