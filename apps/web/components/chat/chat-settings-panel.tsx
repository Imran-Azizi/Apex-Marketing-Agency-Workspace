"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chatApi,
  type ChatEmployeePolicy,
  type ChatOrgSettings,
} from "@/lib/chat";

const POLICY_OPTIONS: Array<{
  value: ChatEmployeePolicy;
  label: string;
  hint: string;
}> = [
  {
    value: "DISABLED",
    label: "غیرفعال",
    hint: "کارمندان نمی‌توانند با یکدیگر گفتگو کنند (پیش‌فرض امن)",
  },
  {
    value: "ALL_EMPLOYEES",
    label: "همه کارمندان",
    hint: "همه کارمندان می‌توانند با هم گفتگو کنند",
  },
  {
    value: "SAME_TEAM",
    label: "فقط هم‌تیمی",
    hint: "فقط اعضای یک تیم (مثلاً ادیتور با ادیتور)",
  },
  {
    value: "SELECTED",
    label: "انتخابی",
    hint: "فقط جفت‌های تأییدشده توسط مدیر",
  },
];

export function ChatSettingsPanel({
  open,
  onOpenChange,
  settings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings?: ChatOrgSettings;
  onSaved: () => void;
}) {
  const [policy, setPolicy] = useState<ChatEmployeePolicy>(
    settings?.employeePolicy || "DISABLED",
  );
  const [saving, setSaving] = useState(false);
  const [userA, setUserA] = useState("");
  const [userB, setUserB] = useState("");

  // Sync when dialog opens with fresh settings
  const effectivePolicy = open
    ? policy || settings?.employeePolicy || "DISABLED"
    : "DISABLED";

  async function save() {
    setSaving(true);
    try {
      await chatApi.updateSettings(policy);
      toast.success("تنظیمات گفتگو ذخیره شد");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ذخیره ناموفق");
    } finally {
      setSaving(false);
    }
  }

  async function addPair() {
    if (!userA.trim() || !userB.trim()) return;
    try {
      await chatApi.addPair(userA.trim(), userB.trim());
      setUserA("");
      setUserB("");
      toast.success("جفت مجاز افزوده شد");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "افزودن ناموفق");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v && settings?.employeePolicy) setPolicy(settings.employeePolicy);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>مدیریت گفتگوی کارمندان</DialogTitle>
          <DialogDescription>
            این تنظیم در سرور اعمال می‌شود و فوراً همه درخواست‌های API و سوکت را محدود می‌کند.
            مدیران همیشه می‌توانند با همه گفتگو کنند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">گفتگوی کارمند با کارمند</p>
          {POLICY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 hover:bg-muted/40"
            >
              <input
                type="radio"
                name="chat-policy"
                className="mt-1"
                checked={effectivePolicy === opt.value}
                onChange={() => setPolicy(opt.value)}
              />
              <span>
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {policy === "SELECTED" || settings?.employeePolicy === "SELECTED" ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-sm font-medium">جفت‌های مجاز</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="شناسه کاربر اول"
                value={userA}
                onChange={(e) => setUserA(e.target.value)}
              />
              <input
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="شناسه کاربر دوم"
                value={userB}
                onChange={(e) => setUserB(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={() => void addPair()}>
                افزودن
              </Button>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {(settings?.allowPairs || []).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                >
                  <span>
                    {p.userLow?.fullName || p.userLowId} ↔{" "}
                    {p.userHigh?.fullName || p.userHighId}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void chatApi.removePair(p.id).then(() => {
                        toast.success("حذف شد");
                        onSaved();
                      })
                    }
                  >
                    حذف
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
