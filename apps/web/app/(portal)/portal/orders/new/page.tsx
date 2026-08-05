"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";

interface Service {
  id: string;
  name: string;
}

const schema = z.object({
  serviceId: z.string().optional(),
  goal: z.string().optional(),
  durationSec: z.coerce.number().positive("مدت باید عدد مثبت باشد").optional(),
  description: z.string().min(10, "توضیحات حداقل ۱۰ حرف باشد"),
});

type OrderForm = z.infer<typeof schema>;

export default function NewOrderPage() {
  const router = useRouter();
  const [serviceId, setServiceId] = useState<string>("");

  const { data: services } = useQuery({
    queryKey: ["public-services"],
    queryFn: () => apiGet<Service[]>("/public/services"),
  });

  const createOrder = useMutation({
    mutationFn: (body: OrderForm) =>
      apiPost("/portal/orders", {
        ...body,
        serviceId: serviceId || undefined,
        durationSec: body.durationSec || undefined,
      }),
    onSuccess: () => {
      toast.success("سفارش ثبت شد — تیم اپیکس با شما تماس می‌گیرد");
      router.push("/portal");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ثبت سفارش ناموفق بود");
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderForm>({
    resolver: zodResolver(schema),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">سفارش جدید</h1>

      <Card>
        <CardHeader>
          <CardTitle>فرم سفارش</CardTitle>
          <CardDescription>
            جزئیات پروژه مورد نظر خود را وارد کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((d) => createOrder.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>نوع خدمت</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب خدمت" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">هدف ویدیو</Label>
              <Input id="goal" {...register("goal")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationSec">مدت تقریبی (ثانیه)</Label>
              <Input
                id="durationSec"
                type="number"
                dir="ltr"
                {...register("durationSec")}
              />
              {errors.durationSec && (
                <p className="text-sm text-destructive">
                  {errors.durationSec.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                rows={5}
                {...register("description")}
                placeholder="درباره پروژه، محصول یا خدمت خود بنویسید..."
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="brand"
              className="w-full"
              disabled={createOrder.isPending}
            >
              {createOrder.isPending ? "در حال ثبت..." : "ثبت سفارش"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
