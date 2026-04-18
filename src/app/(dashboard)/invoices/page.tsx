"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserDocuments,
  updateDocument,
  addDocument,
  Invoice,
  Customer,
  Account,
  Transaction,
  BusinessProfile,
  getDocument,
} from "@/lib/firebase/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Download, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";

const paymentSchema = z.object({
  accountId: z.string().min(1, "Please select an account to receive funds"),
  amountPaid: z.coerce.number().min(0.01, "Amount must be positive"),
  tdsDeducted: z.coerce.number().min(0, "Cannot be negative"),
  paymentDate: z.string().min(1, "Date is required"),
});

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema) as Resolver<
      z.infer<typeof paymentSchema>
    >,
    defaultValues: {
      accountId: "",
      amountPaid: 0,
      tdsDeducted: 0,
      paymentDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const fetchData = async () => {
    if (!user) return;
    try {
      const [invs, custs, accs, biz] = await Promise.all([
        getUserDocuments<Invoice>("invoices", user.uid),
        getUserDocuments<Customer>("customers", user.uid),
        getUserDocuments<Account>("accounts", user.uid, []), // you might want to filter by type=="income" or "asset"
        getDocument<BusinessProfile>("businesses", user.uid),
      ]);

      setInvoices(
        invs.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );

      const custMap: Record<string, Customer> = {};
      custs.forEach((c) => {
        if (c.id) custMap[c.id] = c;
      });
      setCustomers(custMap);

      setAccounts(accs);
      setBusiness(biz);
    } catch (error) {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleDownload = async (invoice: Invoice) => {
    if (!business) {
      toast.error("Please set up business profile first");
      return;
    }
    const customer = customers[invoice.customerId];
    if (!customer) return;

    try {
      const blob = await pdf(
        <InvoicePDF
          invoice={invoice}
          business={business}
          customer={customer}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice_${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to generate PDF");
    }
  };

  const onPaySubmit = async (data: z.infer<typeof paymentSchema>) => {
    if (!user || !payInvoice || !payInvoice.id) return;
    try {
      // 1. Update invoice status
      await updateDocument("invoices", payInvoice.id, {
        status: "paid",
        paidAmount: data.amountPaid,
        tdsDeducted: data.tdsDeducted,
        paymentDate: data.paymentDate,
        accountId: data.accountId,
      });

      // 2. Log transaction to sub-account (if selected)
      if (data.accountId) {
        // Log the actual payment received
        await addDocument<Transaction>("transactions", {
          userId: user.uid,
          accountId: data.accountId,
          amount: data.amountPaid,
          date: data.paymentDate,
          description: `Payment for Invoice #${payInvoice.invoiceNumber}`,
          type: "income",
          referenceType: "invoice",
          referenceId: payInvoice.id,
        });

        // Optional: If TDS needs to be tracked as a separate transaction in a TDS/Tax account,
        // you would add another transaction here if you had a designated TDS account.
      }

      toast.success("Invoice marked as paid!");
      setPayInvoice(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to mark invoice as paid");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            Manage your invoices and track payments.
          </p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </Link>
      </div>

      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    {customers[inv.customerId]?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(inv.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {inv.total.toFixed(2)} {inv.currency}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(inv)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {inv.status !== "paid" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPayInvoice(inv);
                          form.setValue("amountPaid", inv.total);
                        }}>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!payInvoice}
        onOpenChange={(open) => !open && setPayInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onPaySubmit)}
              className="space-y-4">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Received</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      Actual amount received after TDS/deductions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tdsDeducted"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TDS Deducted (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit to Sub-Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id!}>
                            {acc.name} ({acc.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The received amount will be logged to this account in the
                      Base Currency.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Confirm Payment
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
