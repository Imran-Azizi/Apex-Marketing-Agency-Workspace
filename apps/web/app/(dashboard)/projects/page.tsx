"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getMe } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface AssignmentRecord {
  role: string;
  teamProfile?: { displayName?: string | null };
  user?: { fullName?: string | null };
}

interface Project {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  deadlineAt: string | null;
  progress?: ProjectProgress | number | null;
  crmCustomer: { personName: string; companyName: string | null };
  assignments?: AssignmentRecord[];
}

function getAssignedPerson(project: Project, role: "EDITOR" | "NARRATOR") {
  const assignment = project.assignments?.find((item) => item.role === role);
  return (
    assignment?.teamProfile?.displayName || assignment?.user?.fullName || null
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
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
  const canDeleteProject = hasPermission(me?.permissions, "projects.delete", me?.role);
  const canViewProjects = hasPermission(me?.permissions, "projects.view", me?.role);

  useEffect(() => {
    if (!me?.role) return;
    if (canViewProjects) return;
    if (me.role === "NARRATOR") {
      router.replace("/narrator/dashboard");
    }
    if (me.role === "EDITOR") {
      router.replace("/editor/dashboard");
    }
  }, [me, router, canViewProjects]);

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
    <div className="min-w-0">
      <PageHeader
        inline
        title="پروژه‌ها"
        subtitle="لیست پروژه‌های فعال و تکمیل‌شده"
      />

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

      {isLoading && <LoadingTable columns={canDeleteProject ? 9 : 8} />}

      {error && <EmptyState title="بارگذاری پروژه‌ها ناموفق بود" />}

      {data && data.length === 0 && (
        <EmptyState title="پروژه‌ای ثبت نشده است" />
      )}

      {data && data.length > 0 && (
        <HorizontalScroll>
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  کد
                </TableHead>
                <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  عنوان
                </TableHead>
                <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  مشتری
                </TableHead>
                <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  ادیتور
                </TableHead>
                <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  نریتور
                </TableHead>
                <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  وضعیت
                </TableHead>
                <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  پیشرفت پروژه
                </TableHead>
                <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  مهلت
                </TableHead>
                {canDeleteProject && (
                  <TableHead className="sticky top-0 z-[1] w-14 bg-muted/95 text-center backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    عملیات
                  </TableHead>
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
                    <span
                      className="whitespace-nowrap font-medium text-foreground"
                      dir="ltr"
                    >
                      {project.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block min-w-[8rem] max-w-[16rem] font-medium leading-snug">
                      {project.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[8rem]">
                      <span className="font-medium">
                        {project.crmCustomer.personName}
                      </span>
                      {project.crmCustomer.companyName && (
                        <span className="block text-xs text-muted-foreground">
                          {project.crmCustomer.companyName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getAssignedPerson(project, "EDITOR") ? (
                      <div
                        className="flex min-w-[10rem] items-center gap-3 overflow-hidden text-sm"
                        title={getAssignedPerson(project, "EDITOR") || ""}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {initials(getAssignedPerson(project, "EDITOR") || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">
                          {getAssignedPerson(project, "EDITOR")}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex min-w-[10rem] items-center text-sm text-muted-foreground">
                        تعیین نشده
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getAssignedPerson(project, "NARRATOR") ? (
                      <div
                        className="flex min-w-[10rem] items-center gap-3 overflow-hidden text-sm"
                        title={getAssignedPerson(project, "NARRATOR") || ""}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {initials(getAssignedPerson(project, "NARRATOR") || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">
                          {getAssignedPerson(project, "NARRATOR")}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex min-w-[10rem] items-center text-sm text-muted-foreground">
                        تعیین نشده
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {getProjectStatusLabel(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="min-w-[10rem]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ProjectProgressBar
                      progress={project.progress}
                      status={project.status}
                      variant="inline"
                      showTitle={false}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {project.deadlineAt
                      ? formatDate(project.deadlineAt)
                      : "—"}
                  </TableCell>
                  {canDeleteProject && (
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
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
        </HorizontalScroll>
      )}
    </div>
  );
}
