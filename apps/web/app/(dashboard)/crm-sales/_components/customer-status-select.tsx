"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPatch, ApiError } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  stageControl,
} from "./constants";
import { crmSalesText } from "./copy";
import { RepeatCustomerDialog } from "./repeat-customer-dialog";
import type { CrmCustomer } from "./types";

interface CustomerStatusSelectProps {
  customer: CrmCustomer;
  canEdit?: boolean;
  role?: string | null;
}

interface StageChangeResult extends CrmCustomer {
  repeatCycle?: {
    opportunityId?: string;
    opportunityCreated?: boolean;
    portalInviteCreated?: boolean;
  };
}

export function CustomerStatusSelect({
  customer,
  canEdit = false,
  role,
}: CustomerStatusSelectProps) {
  const qc = useQueryClient();
  const [repeatOpen, setRepeatOpen] = useState(false);
  const current = customer.pipelineStage || "NEW_LEAD";
  const control = stageControl(current);
  const canChange =
    canEdit && customer.allowedActions?.changeStatus !== false;

  const mutation = useMutation({
    mutationFn: ({ stage }: { stage: string }) =>
      apiPatch<StageChangeResult>(`/crm/customers/${customer.id}/stage`, {
        stage,
      }),
    onSuccess: async (result, variables) => {
      if (variables.stage === "REPEAT_CUSTOMER") {
        toast.success(crmSalesText("repeatCustomerSuccess"));
        setRepeatOpen(false);
      } else {
        toast.success(crmSalesText("statusUpdated"));
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["crm-customers"] }),
        qc.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["crm-customer", customer.id] }),
      ]);
      void result;
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : crmSalesText("statusUpdateFailed");
      toast.error(message || crmSalesText("statusUpdateFailed"));
    },
  });

  if (!canChange) {
    return (
      <div className="space-y-1">
        <span className="inline-flex min-h-8 items-center text-xs font-medium">
          {customer.pipelineStageLabel || STAGE_LABELS[current] || "—"}
        </span>
        {control === "automatic" || control === "completed" ? (
          <p className="max-w-[14rem] text-[10px] leading-snug text-muted-foreground">
            {control === "completed"
              ? crmSalesText("statusDeliveredHint")
              : crmSalesText("statusAutomaticHint")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Select
        value={current}
        disabled={mutation.isPending}
        onValueChange={(stage) => {
          if (stage === current) return;
          if (stage === "REPEAT_CUSTOMER") {
            setRepeatOpen(true);
            return;
          }
          mutation.mutate({ stage });
        }}
      >
        <SelectTrigger
          aria-label={crmSalesText("statusLabel")}
          className="h-8 min-w-[11rem] max-w-[15rem] border-border/70 bg-background text-xs"
          title={crmSalesText("statusLabel")}
        >
          <SelectValue>
            {mutation.isPending
              ? crmSalesText("statusSaving")
              : customer.pipelineStageLabel || STAGE_LABELS[current] || "—"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {PIPELINE_STAGES.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {STAGE_LABELS[stage] || stage}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <RepeatCustomerDialog
        open={repeatOpen}
        onOpenChange={setRepeatOpen}
        pending={mutation.isPending}
        customerName={customer.personName}
        onConfirm={() => {
          mutation.mutate({ stage: "REPEAT_CUSTOMER" });
        }}
      />
    </div>
  );
}
