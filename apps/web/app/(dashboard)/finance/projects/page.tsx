"use client";



import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Search, X } from "lucide-react";

import { apiGet } from "@/lib/api";

import { PageHeader } from "@/components/shared/page-header";

import { EmptyState } from "@/components/shared/empty-state";

import { LoadingTable } from "@/components/shared/loading-table";

import { Input } from "@/components/ui/input";

import { FinanceProjectsTable } from "../_components/finance-projects-table";

import { FinanceProjectDetailsModal } from "../_components/finance-project-details-modal";

import { type FinanceProject } from "../_components/types";



type ListResponse = { items: FinanceProject[]; total: number };



export default function FinanceProjectsPage() {

  const [searchInput, setSearchInput] = useState("");

  const [q, setQ] = useState("");

  const [selectedProject, setSelectedProject] = useState<FinanceProject | null>(

    null,

  );

  const [detailsOpen, setDetailsOpen] = useState(false);



  useEffect(() => {

    const timer = setTimeout(() => setQ(searchInput.trim()), 350);

    return () => clearTimeout(timer);

  }, [searchInput]);



  const query = useQuery({

    queryKey: ["finance-projects", q],

    queryFn: () => {

      const params = new URLSearchParams();

      if (q) params.set("q", q);

      const qs = params.toString();

      return apiGet<ListResponse>(`/finance/projects${qs ? `?${qs}` : ""}`);

    },

    refetchOnWindowFocus: true,

  });



  const items = query.data?.items || [];

  const total = query.data?.total ?? items.length;



  function openDetails(project: FinanceProject) {

    setSelectedProject(project);

    setDetailsOpen(true);

  }



  return (

    <div className="space-y-5">

      <PageHeader

        title="پروژه‌ها (نمای مالی)"

        subtitle="مبلغ کل، پرداخت‌شده، مانده و تاریخچه پرداخت هر پروژه — همگام با پایگاه داده"

        actions={

          <div className="relative w-full sm:w-[260px]">

            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input

              placeholder="جستجو: نام، کد، مشتری..."

              value={searchInput}

              onChange={(e) => setSearchInput(e.target.value)}

              className="ps-9 pe-9"

              aria-label="جستجوی پروژه‌ها"

            />

            {searchInput ? (

              <button

                type="button"

                onClick={() => setSearchInput("")}

                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"

                aria-label="پاک کردن جستجو"

              >

                <X className="h-4 w-4" />

              </button>

            ) : null}

          </div>

        }

      />



      {!query.isLoading && !query.isError && items.length > 0 ? (

        <p className="text-xs text-muted-foreground">

          {total.toLocaleString("fa-AF", { numberingSystem: "latn" })} پروژه

          {q ? " مطابق جستجو" : ""}

        </p>

      ) : null}



      {query.isLoading ? (

        <LoadingTable rows={8} columns={8} />

      ) : query.isError ? (

        <p className="text-sm text-destructive">خطا در بارگذاری پروژه‌ها</p>

      ) : items.length === 0 ? (

        <EmptyState

          title="پروژه‌ای یافت نشد"

          description={

            q

              ? "عبارت جستجو را تغییر دهید یا فیلتر را پاک کنید."

              : "هنوز پروژه‌ای در سیستم ثبت نشده است."

          }

        />

      ) : (

        <FinanceProjectsTable items={items} onSelect={openDetails} />

      )}



      <FinanceProjectDetailsModal

        project={selectedProject}

        open={detailsOpen}

        onOpenChange={setDetailsOpen}

        onPaymentCreated={async () => {

          const result = await query.refetch();

          const next = result.data?.items.find(

            (item) => item.id === selectedProject?.id,

          );

          if (next) setSelectedProject(next);

        }}

      />

    </div>

  );

}

