"use client";

import { useEffect, useState } from "react";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserDocuments,
  addDocument,
  Customer,
  BusinessProfile,
  getDocument,
} from "@/lib/firebase/db";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";

const itemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Invalid price"),
  taxRate: z.coerce.number().min(0, "Invalid tax"),
});

const formSchema = z.object({
  customerId: z.string().min(1, "Customer required"),
  invoiceNumber: z.string().min(1, "Invoice number required"),
  date: z.string().min(1, "Date required"),
  dueDate: z.string().min(1, "Due date required"),
  currency: z.string().min(3, "Currency required"),
  items: z.array(itemSchema).min(1, "At least one item required"),
});

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"];

export default function NewInvoicePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
    defaultValues: {
      customerId: "",
      invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
      date: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd",
      ), // 14 days
      currency: "USD", // will be updated once profile loads
      items: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");

  const subTotal = watchItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0,
  );
  const taxTotal = watchItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice * (item.taxRate / 100),
    0,
  );
  const total = subTotal + taxTotal;

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const [custData, bizData] = await Promise.all([
          getUserDocuments<Customer>("customers", user.uid),
          getDocument<BusinessProfile>("businesses", user.uid),
        ]);
        setCustomers(custData);
        if (bizData) {
          setBusiness(bizData);
          form.setValue("currency", bizData.baseCurrency);
        }
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, form]);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (!user) return;
    try {
      const itemsWithIds = data.items.map((item) => ({
        id: Math.random().toString(36).substring(7),
        ...item,
      }));

      const subTotal = itemsWithIds.reduce(
        (acc, item) => acc + item.quantity * item.unitPrice,
        0,
      );
      const taxTotal = itemsWithIds.reduce(
        (acc, item) =>
          acc + item.quantity * item.unitPrice * (item.taxRate / 100),
        0,
      );
      const total = subTotal + taxTotal;

      await addDocument("invoices", {
        userId: user.uid,
        customerId: data.customerId,
        invoiceNumber: data.invoiceNumber,
        date: data.date,
        dueDate: data.dueDate,
        currency: data.currency,
        items: itemsWithIds,
        subTotal,
        taxTotal,
        total,
        status: "draft",
      });

      toast.success("Invoice created successfully");
      router.push("/invoices");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create invoice");
    }
  }

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">Create Invoice</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-lg border">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id!}>
                          {c.name}
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
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
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
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border space-y-4">
            <h3 className="font-semibold text-lg">Line Items</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-4 items-start">
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className={index !== 0 ? "sr-only" : ""}>
                        Description
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Item description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <FormLabel className={index !== 0 ? "sr-only" : ""}>
                        Qty
                      </FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel className={index !== 0 ? "sr-only" : ""}>
                        Price
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.taxRate`}
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <FormLabel className={index !== 0 ? "sr-only" : ""}>
                        Tax %
                      </FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-8">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  taxRate: 0,
                })
              }>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>

          <div className="bg-white p-6 rounded-lg border flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>
                  {subTotal.toFixed(2)} {form.watch("currency")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span>
                  {taxTotal.toFixed(2)} {form.watch("currency")}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-3 border-t">
                <span>Total:</span>
                <span>
                  {total.toFixed(2)} {form.watch("currency")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit">Save Draft Invoice</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
