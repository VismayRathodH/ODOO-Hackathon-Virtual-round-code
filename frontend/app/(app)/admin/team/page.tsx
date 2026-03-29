"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Users, UserPlus, FileEdit, CheckCircle2, AlertCircle, Loader2, ShieldAlert
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { adminApi, AdminUser } from "@/lib/api/admin";
import { Role } from "@/types/auth";
import { cn } from "@/lib/utils";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Schemas
const inviteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]),
  managerId: z.string().optional(),
});

const editSchema = z.object({
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]),
  managerId: z.string().optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;
type EditFormValues = z.infer<typeof editSchema>;

export default function AdminTeamPage() {
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Route Guard
  useEffect(() => {
    if (role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Queries
  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin_users"],
    queryFn: adminApi.getUsers,
    enabled: role === "ADMIN",
    staleTime: 60 * 1000,
  });

  // Derived
  const managers = users?.filter(u => u.role === "MANAGER" || u.role === "ADMIN") || [];

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("User successfully invited to the organization.");
      setIsInviteOpen(false);
      inviteForm.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to invite user.");
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: { id: string, payload: { role?: Role; managerId?: string } }) => 
      adminApi.updateUser(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("User permissions updated successfully.");
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user.");
    }
  });

  // Forms
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: "", email: "", role: "EMPLOYEE", managerId: "" },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { role: "EMPLOYEE", managerId: "" },
  });

  // Handlers
  const onInviteSubmit = (values: InviteFormValues) => {
    inviteMutation.mutate({
      name: values.name,
      email: values.email,
      role: values.role as Role,
      managerId: values.managerId === "none" ? undefined : values.managerId || undefined,
    });
  };

  const onEditSubmit = (values: EditFormValues) => {
    if (editingUser) {
      editMutation.mutate({
        id: editingUser.id,
        payload: {
          role: values.role as Role,
          managerId: values.managerId === "none" ? undefined : values.managerId || undefined,
        }
      });
    }
  };

  const openEditSheet = (user: AdminUser) => {
    setEditingUser(user);
    editForm.reset({
      role: user.role,
      managerId: user.managerId || "none"
    });
  };

  if (role !== "ADMIN") return null;

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case "ADMIN":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 border-none font-semibold">ADMIN</Badge>;
      case "MANAGER":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 border-none font-semibold">MANAGER</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 border-none">EMPLOYEE</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10">
            <ShieldAlert className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage organization users, roles, and reporting lines.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Invite User
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="h-6 w-6 text-destructive mb-2" />
                    Failed to load users from server.
                  </div>
                </TableCell>
              </TableRow>
            ) : users?.length === 0 ? (
               <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  No users found in this organization.
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border/50">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}&backgroundColor=random`} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-medium">
                    {user.managerName || "—"}
                  </TableCell>
                  <TableCell>
                    {user.status === "ACTIVE" && <span className="flex items-center text-xs font-semibold text-green-600 dark:text-green-400 gap-1.5"><CheckCircle2 className="h-3.5 w-3.5"/> Active</span>}
                    {user.status === "INVITED" && <span className="flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin"/> Invited</span>}
                    {user.status === "INACTIVE" && <span className="flex items-center text-xs font-semibold text-muted-foreground gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Inactive</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditSheet(user)} title="Edit Configuration">
                      <FileEdit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* INVITE DIALOG */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Add a new member to your organization. They will receive an email invitation to set their password.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
              <FormField 
                control={inviteForm.control} 
                name="name" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              <FormField 
                control={inviteForm.control} 
                name="email" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="jane@company.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              <FormField 
                control={inviteForm.control} 
                name="role" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Assignment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee (Base Submit Access)</SelectItem>
                        <SelectItem value="MANAGER">Manager (Queue Access)</SelectItem>
                        <SelectItem value="ADMIN">Admin (Full Control)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              <FormField 
                control={inviteForm.control} 
                name="managerId" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Direct report line (Optional)" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Manager</SelectItem>
                        {managers.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* EDIT SHEET (Slide-over) */}
      <Sheet open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader className="mb-6">
            <SheetTitle>Edit User Profile</SheetTitle>
            <SheetDescription>
              Modify role assignments or reporting lines for <span className="font-semibold text-foreground">{editingUser?.name}</span>.
            </SheetDescription>
          </SheetHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-6 flex-1">
                {/* Visual Context */}
                <div className="bg-muted/40 border p-4 rounded-lg flex items-center gap-4">
                  <Avatar className="h-12 w-12 border bg-background">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${editingUser?.name || 'A'}&backgroundColor=random`} />
                    <AvatarFallback>{editingUser?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{editingUser?.name}</div>
                    <div className="text-xs text-muted-foreground">{editingUser?.email}</div>
                  </div>
                </div>

                <FormField 
                  control={editForm.control} 
                  name="role" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE">Employee</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <FormField 
                  control={editForm.control} 
                  name="managerId" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reporting Manager</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Manager</SelectItem>
                          {managers.filter(m => m.id !== editingUser?.id).map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name} ({m.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} 
                />
              </div>

              <SheetFooter className="pt-6 border-t mt-auto">
                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

    </div>
  );
}
