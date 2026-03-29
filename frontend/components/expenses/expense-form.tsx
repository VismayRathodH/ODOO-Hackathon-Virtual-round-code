"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const expenseSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  category: z.string().min(2, { message: "Category is required" }),
  date: z.string().min(1, { message: "Date is required" }),
  description: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [receipt, setReceipt] = useState<File | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      amount: "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  async function onSubmit(values: ExpenseFormValues) {
    setIsLoading(true);
    try {
      // Mocking API call
      console.log("Submitting expense:", { ...values, receipt });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast.success("Expense submitted successfully!");
      router.push("/expenses");
      router.refresh();
    } catch (error) {
      toast.error("Failed to submit expense");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-lg border-none">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">New Reimbursement Request</CardTitle>
        <CardDescription>
          Fill in the details below to submit your expense for approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Title / Purpose</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. AWS Cloud Services Subscription" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Software, Travel, Meals" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Add more details about this expense..."
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Receipt Upload</FormLabel>
              <div className={cn(
                "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all",
                receipt ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/30"
              )}>
                {receipt ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 font-medium text-primary bg-primary/10 px-4 py-2 rounded-full">
                      <Upload className="h-4 w-4" /> {receipt.name}
                      <button type="button" onClick={() => setReceipt(null)} className="hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">Ready for upload</span>
                  </div>
                ) : (
                  <label className="cursor-pointer group flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-medium">Click to upload or drag and drop</span>
                    <span className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 10MB</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Claim"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
