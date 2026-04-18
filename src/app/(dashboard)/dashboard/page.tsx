"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText, Users, Wallet, ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getUserDocuments,
  getDocument,
  Transaction,
  Invoice,
  Customer,
  BusinessProfile,
} from "@/lib/firebase/db";
import { format, getYear, getMonth } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDocument, Account, TransactionCategory } from "@/lib/firebase/db";

const transactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(2, "Description required"),
  type: z.enum(["income", "expense"]),
});

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeInvoices: 0,
    totalCustomers: 0,
  });
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);

  const [openTxModal, setOpenTxModal] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const txForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      accountId: "",
      categoryId: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      description: "",
      type: "expense",
    },
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      const profile = await getDocument<BusinessProfile>(
        "businesses",
        user.uid,
      );
      if (profile) setBaseCurrency(profile.baseCurrency);

      const [txs, invoices, customersList, userAccounts, userCategories] =
        await Promise.all([
          getUserDocuments<Transaction>("transactions", user.uid),
          getUserDocuments<Invoice>("invoices", user.uid),
          getUserDocuments<Customer>("customers", user.uid),
          getUserDocuments<Account>("accounts", user.uid),
          getUserDocuments<TransactionCategory>(
            "transactionCategories",
            user.uid,
          ),
        ]);

      setAccounts(userAccounts);
      setCategories(userCategories);

      // Financial Year Logic (Assuming April 1st to March 31st)
      const now = new Date();
      const currentMonth = getMonth(now); // 0-indexed (0 = Jan, 3 = Apr)
      const currentYear = getYear(now);

      let fyStart: Date;
      if (currentMonth >= 3) {
        fyStart = new Date(currentYear, 3, 1); // April 1st of current year
      } else {
        fyStart = new Date(currentYear - 1, 3, 1); // April 1st of previous year
      }

      const fyStartTimestamp = fyStart.getTime();

      // Calculate Revenue (Sum of positive transactions in current FY)
      const totalRevenue = txs
        .filter(
          (tx) =>
            tx.type === "income" &&
            tx.amount > 0 &&
            new Date(tx.date).getTime() >= fyStartTimestamp,
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Active Invoices (Unpaid or partially paid in current FY)
      const activeInvoices = invoices.filter(
        (inv) =>
          (inv.status === "sent" || inv.status === "draft") &&
          new Date(inv.date).getTime() >= fyStartTimestamp,
      ).length;

      setStats({
        totalRevenue,
        activeInvoices,
        totalCustomers: customersList.length, // All customers, not just FY
      });

      // Recent Transactions (Sort by date desc, take top 10)
      const sortedTxs = [...txs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setRecentTransactions(sortedTxs.slice(0, 10));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  async function onTxSubmit(data: z.infer<typeof transactionSchema>) {
    if (!user) return;
    try {
      const amount =
        data.type === "expense"
          ? -Math.abs(data.amount)
          : Math.abs(data.amount);
      await addDocument<Transaction>("transactions", {
        userId: user.uid,
        ...data,
        amount,
      });
      toast.success("Transaction added");
      setOpenTxModal(false);
      txForm.reset();
      fetchData(); // Refresh the dashboard list
    } catch (error) {
      toast.error("Failed to add transaction");
    }
  }

  async function handleAddCategory() {
    if (!user) return;
    if (!newCategoryName.trim()) {
      setIsAddingCategory(false);
      return;
    }
    try {
      const catId = await addDocument("transactionCategories", {
        userId: user.uid,
        name: newCategoryName.trim(),
      });
      setCategories([
        ...categories,
        { id: catId, userId: user.uid, name: newCategoryName.trim() },
      ]);
      txForm.setValue("categoryId", catId);
      setNewCategoryName("");
      setIsAddingCategory(false);
      toast.success("Category created");
    } catch (error) {
      toast.error("Failed to create category");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome back, {user?.displayName || "User"}
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue (FY)
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">In {baseCurrency}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Invoices (FY)
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeInvoices}</div>
            <p className="text-xs text-muted-foreground">
              Unpaid or draft invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Registered in directory
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Latest financial activities across all accounts
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Dialog open={openTxModal} onOpenChange={setOpenTxModal}>
                <DialogTrigger>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Transaction</DialogTitle>
                  </DialogHeader>
                  <Form {...txForm}>
                    <form
                      onSubmit={txForm.handleSubmit(onTxSubmit)}
                      className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={txForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                items={[
                                  { value: "income", label: "Income" },
                                  { value: "expense", label: "Expense" },
                                ]}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="income">Income</SelectItem>
                                  <SelectItem value="expense">
                                    Expense
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={txForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={txForm.control}
                        name="accountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              items={accounts.map((acc) => ({
                                value: acc.id!,
                                label: `${acc.name} (${acc.type})`,
                              }))}>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={txForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <div className="flex gap-2">
                              {isAddingCategory ? (
                                <Input
                                  placeholder="New category..."
                                  value={newCategoryName}
                                  onChange={(e) =>
                                    setNewCategoryName(e.target.value)
                                  }
                                  className="flex-1"
                                />
                              ) : (
                                <div className="flex-1">
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    items={categories.map((c) => ({
                                      value: c.id!,
                                      label: c.name,
                                    }))}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id!}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={
                                  isAddingCategory
                                    ? handleAddCategory
                                    : () => setIsAddingCategory(true)
                                }>
                                {isAddingCategory ? (
                                  "Save"
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={txForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount ({baseCurrency})</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={txForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Client Dinner"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full">
                        Save Transaction
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/accounts?tab=transactions" />}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">
                    Amount ({baseCurrency})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground">
                      No recent transactions
                    </TableCell>
                  </TableRow>
                ) : (
                  recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          tx.amount < 0 ? "text-red-500" : "text-green-600"
                        }`}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
