"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import {
  canTransferToManagement,
  getTransferBlockReason,
} from "./constants";
import { crmSalesText } from "./copy";
import type { CrmCustomer, CrmTransferResult } from "./types";

function transferDisabledMessage(customer: CrmCustomer): string | undefined {
  const reason = getTransferBlockReason(customer);
  if (reason === "delivered") return crmSalesText("transferDisabledDelivered");
  if (reason === "lost") return crmSalesText("transferDisabledLost");
  if (reason === "already") return crmSalesText("transferDisabledAlready");
  return undefined;
}

export function useCustomerTransfer(customer: CrmCustomer, canTransfer = false) {
  const qc = useQueryClient();
  const alreadySent = Boolean(customer.isConverted);
  const allowed =
    canTransfer &&
    !alreadySent &&
    customer.allowedActions?.transferToManagement !== false &&
    canTransferToManagement(customer);
  const disabledReason = transferDisabledMessage(customer);

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<CrmTransferResult>("/crm/customers/transfer", {
        ids: [customer.id],
      }),
    onSuccess: async (result) => {
      const transferred = result.transferred.length;
      const already = result.alreadyTransferred.length;
      const skipped = result.skipped.length;
      const failed = result.failed.length;

      if (transferred > 0) {
        toast.success(crmSalesText("transferSuccess"));
      } else if (already > 0) {
        toast.success(crmSalesText("transferAlready", { count: 1 }));
      } else if (skipped > 0) {
        const reason = result.skipped[0]?.reason;
        toast.error(reason || crmSalesText("transferFailed"));
      } else if (failed > 0) {
        const message = result.failed[0]?.message;
        toast.error(message || crmSalesText("transferFailed"));
      } else {
        toast.error(crmSalesText("transferFailed"));
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["crm-customers"] }),
        qc.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : crmSalesText("transferFailed");
      toast.error(message || crmSalesText("transferFailed"));
    },
  });

  const transferLabel = mutation.isPending
    ? crmSalesText("transferring")
    : alreadySent
      ? crmSalesText("transferAlreadySent")
      : crmSalesText("transferToCustomers");

  const transferHint = alreadySent
    ? crmSalesText("transferDisabledAlready")
    : allowed
      ? crmSalesText("transferToCustomers")
      : disabledReason || crmSalesText("transferFailed");

  return {
    alreadySent,
    allowed,
    disabledReason,
    transferHint,
    transferLabel,
    isPending: mutation.isPending,
    transfer: () => mutation.mutate(),
  };
}
