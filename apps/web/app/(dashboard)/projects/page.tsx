"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getMe } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getProjectStatusLabel } from "@/lib/project-status";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import type { ProjectProgress } from "@/lib/project-progress";

interface Project {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  deadlineAt: string | null;
  progress?: ProjectProgress | number | null;
  crmCustomer: { personName: string; companyName: string | null };
}

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>("/projects"),
  });

  const { data: me } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    retry: false,
  });
  const isManager = me?.role === "MANAGER" || me?.role === "ADMIN";

  useEffect(() => {
    if (me?.role === "NARRATOR") {
      router.replace("/narrator/dashboard");
    }
    if (me?.role === "EDITOR") {
      router.replace("/editor/dashboard");
    }
  }, [me, router]);

  const deleteProject = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      toast.success("پروژه و تمام سوابق پرداخت مرتبط حذف شد");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customer"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteOpen(false);
      setDeletingProject(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "حذف پروژه ناموفق بود");
    },
  });

  const openDelete = (project: Project) => {
    setDeletingProject(project);
    setDeleteOpen(true);
  };

  const openProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <div>
      <PageHeader title="پروژه‌ها" subtitle="لیست پروژه‌های فعال و تکمیل‌شده" />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle>حذف پروژه</DialogTitle>
            <DialogDescription>
              آیا از حذف پروژه «{deletingProject?.code} —{" "}
              {deletingProject?.title}» مطمئن هستید؟ این عملیات پروژه را از
              مدیریت پروژه، پرونده مشتری، پورتال و داشبورد حذف می‌کند و تمام
              فاکتورها و پرداخت‌های مرتبط نیز پاک می‌شوند. این عمل قابل بازگشت
              نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteProject.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingProject && deleteProject.mutate(deletingProject.id)
              }
              disabled={deleteProject.isPending || !deletingProject}
            >
              {deleteProject.isPending ? "در حال حذف..." : "بله، حذف شود"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading && <LoadingTable columns={isManager ? 7 : 6} />}

      {error && <EmptyState title="بارگذاری پروژه‌ها ناموفق بود" />}

      {data && data.length === 0 && (
        <EmptyState title="پروژه‌ای ثبت نشده است" />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>کد</TableHead>
                <TableHead>عنوان</TableHead>
                <TableHead>مشتری</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="min-w-[160px]">پیشرفت پروژه</TableHead>
                <TableHead>مهلت</TableHead>
                {isManager && (
                  <TableHead className="w-14 text-center">عملیات</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((project) => (
                <TableRow
                  key={project.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`مشاهده جزئیات پروژه ${project.code}`}
                  className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  onClick={() => openProject(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openProject(project.id);
                    }
                  }}
                >
                  <TableCell>
                    <span className="font-medium text-foreground" dir="ltr">
                      {project.code}
                    </span>
                  </TableCell>
                  <TableCell>{project.title}</TableCell>
                  <TableCell>
                    {project.crmCustomer.personName}
                    {project.crmCustomer.companyName && (
                      <span className="block text-xs text-muted-foreground">
                        {project.crmCustomer.companyName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getProjectStatusLabel(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ProjectProgressBar
                      progress={project.progress}
                      status={project.status}
                      variant="inline"
                      showTitle={false}
                    />
                  </TableCell>
                  <TableCell>
                    {project.deadlineAt
                      ? formatDate(project.deadlineAt)
                      : "—"}
                  </TableCell>
                  {isManager && (
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="حذف پروژه"
                        aria-label="حذف پروژه"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(project);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
