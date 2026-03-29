"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Upload, Loader2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { useAuth } from "@/hooks/useAuth";
import { expensesApi } from "@/lib/api/expenses";
import { ocrApi } from "@/lib/api/ocr";
import { currenciesApi } from "@/lib/api/currencies";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const CATEGORIES = ["Food", "Travel", "Accommodation", "Equipment", "Other"] as const;

const expenseSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  currency: z.string().min(1, "Currency is required"),
  category: z.enum(CATEGORIES),
  description: z.string().min(10, { message: "Description must be at least 10 characters long" }),
  date: z.date(),
  receipt: z.any()
    .refine((file) => file instanceof File, "Receipt file is required")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function NewExpensePage() {
  const router = useRouter();
  const { company } = useAuth();
  const companyCurrency = company?.currency || "USD";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: "",
      currency: companyCurrency,
      description: "",
      date: new Date(),
    },
  });

  // Fetch Currencies for the dropdown
  const { data: currencies, isLoading: isCurrenciesLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: currenciesApi.getCurrencies,
    staleTime: Infinity,
  });

  // Watch fields for Live FX
  const amountValue = useWatch({ control: form.control, name: "amount" });
  const currencyValue = useWatch({ control: form.control, name: "currency" });
  const debouncedAmount = useDebounce(amountValue, 500);

  const parsedAmount = parseFloat(debouncedAmount);
  const isValidAmountForFx = !isNaN(parsedAmount) && parsedAmount > 0;
  const shouldFetchFx = Boolean(
    isValidAmountForFx && currencyValue && currencyValue !== companyCurrency
  );

  const { data: fxData, isFetching: isFxFetching } = useQuery({
    queryKey: ["fx", currencyValue, companyCurrency, parsedAmount],
    queryFn: () => currenciesApi.getFxRate(currencyValue, companyCurrency, parsedAmount),
    enabled: shouldFetchFx,
    staleTime: 60 * 1000,
  });

  // OCR Scan Mutation
  const ocrMutation = useMutation({
    mutationFn: (file: File) => ocrApi.scanReceipt(file),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        setOcrConfidence(null);
        return;
      }

      // Auto-fill fields if present
      if (data.amount !== undefined) form.setValue("amount", data.amount.toString(), { shouldValidate: true });
      if (data.vendor) form.setValue("description", data.vendor, { shouldValidate: true });
      if (data.currency) {
        form.setValue("currency", data.currency.toUpperCase(), { shouldValidate: true });
      }
      if (data.category && CATEGORIES.includes(data.category as (typeof CATEGORIES)[number])) {
        form.setValue("category", data.category as (typeof CATEGORIES)[number], { shouldValidate: true });
      }
      if (data.date) {
        const parsedDate = new Date(data.date);
        if (!isNaN(parsedDate.getTime())) {
          form.setValue("date", parsedDate, { shouldValidate: true });
        }
      }
      setOcrConfidence(data.confidence ?? null);
      toast.success("Receipt scanned successfully!");
    },
    onError: () => {
      toast.error("Failed to parse receipt correctly.");
      setOcrConfidence(null);
    },
  });

  // Handle Form Upload Mutation
  const submitMutation = useMutation({
    mutationFn: (payload: {
      amount: number;
      currency: string;
      category: (typeof CATEGORIES)[number];
      description: string;
      date: string;
    }) => expensesApi.createExpense(payload),
    onSuccess: () => {
      toast.success("Expense submitted successfully!");
      router.push("/expenses");
      router.refresh();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit expense.");
    },
  });

  const onSubmit = (values: ExpenseFormValues) => {
    submitMutation.mutate({
      amount: Number.parseFloat(values.amount),
      currency: values.currency.toUpperCase(),
      category: values.category,
      description: values.description,
      date: values.date.toISOString(),
    });
  };

  const selectedFile = useWatch({ control: form.control, name: "receipt" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size must be under 5MB");
        return;
      }
      form.setValue("receipt", file, { shouldValidate: true });
      ocrMutation.mutate(file);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Report Expense</h1>
        <p className="text-muted-foreground mt-1">
          Upload a receipt and fill out the details to request reimbursement.
        </p>
      </div>

      {ocrConfidence !== null && ocrConfidence < 0.7 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-800 dark:text-yellow-400">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 stroke-yellow-600 dark:stroke-yellow-500" />
            Low confidence scan
          </div>
          <p className="text-sm">
            The automated receipt scanner was less confident about this image. Please verify all auto-filled fields manually before submitting.
          </p>
        </div>
      )}

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>All fields are required unless marked otherwise.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Receipt File Upload */}
              <div className="space-y-4 border-b pb-8">
                <FormField
                  control={form.control}
                  name="receipt"
                  render={() => (
                    <FormItem>
                      <FormLabel>Receipt Image</FormLabel>
                      <div
                        className={cn(
                          "mt-2 flex justify-center rounded-lg border border-dashed border-border px-6 py-10 transition-colors",
                          selectedFile ? "bg-primary/5 border-primary/20" : "hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <div className="text-center w-full">
                          {ocrMutation.isPending ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="h-10 w-10 animate-spin text-primary" />
                              <div className="text-sm font-medium text-foreground">Scanning receipt...</div>
                              <div className="text-xs text-muted-foreground animate-pulse">Running Optical Character Recognition</div>
                            </div>
                          ) : selectedFile ? (
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-10 w-10 text-primary" />
                              <div className="text-sm font-medium">{selectedFile.name}</div>
                              <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                Replace File
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                              <div className="mt-4 flex text-sm leading-6 text-muted-foreground text-center">
                                <label
                                  htmlFor="file-upload"
                                  className="relative cursor-pointer rounded-md bg-transparent font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:underline"
                                >
                                  <span>Upload a file</span>
                                  <input
                                    id="file-upload"
                                    name="file-upload"
                                    type="file"
                                    className="sr-only"
                                    ref={fileInputRef}
                                    accept="image/jpeg,image/png,image/jpg,image/webp"
                                    onChange={handleFileChange}
                                  />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                              </div>
                              <p className="text-xs text-muted-foreground leading-5">PNG, JPG, WEBP up to 5MB</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Form Fields inside Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g. 50.00" {...field} />
                      </FormControl>
                      
                      {/* Live FX Preview */}
                      {shouldFetchFx ? (
                         <div className="text-xs text-muted-foreground mt-1 h-4 flex items-center">
                           {isFxFetching ? (
                             <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Calculating equivalent...</span>
                           ) : fxData ? (
                             <span className="font-medium text-foreground">≈ {fxData.convertedAmount.toFixed(2)} {companyCurrency}</span>
                           ) : null}
                         </div>
                      ) : (
                        <div className="text-xs text-transparent mt-1 h-4 select-none">Spacer</div>
                      )}
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isCurrenciesLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies?.map((cur) => (
                            <SelectItem key={cur.code} value={cur.code}>
                              {cur.code} - {cur.name} ({cur.symbol})
                            </SelectItem>
                          ))}
                          {!currencies && (
                             <SelectItem value={companyCurrency}>{companyCurrency}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }: { field: any }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="mb-2">Date of Expense</FormLabel>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            />
                          }
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="Detailed business purpose for this expense..."
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Minimum 10 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={submitMutation.isPending || ocrMutation.isPending}
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitMutation.isPending || ocrMutation.isPending}>
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Expense"
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
