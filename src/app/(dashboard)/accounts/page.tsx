"use client";

import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserDocuments,
  addDocument,
  updateDocument,
  deleteDocument,
  Account,
  Transaction,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

const accountSchema = z.object({
  name: z.string().min(2, "Name required"),
  type: z.enum(["income", "expense", "asset", "liability"]),
  description: z.string().optional(),
});

const transactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(2, "Description required"),
  type: z.enum(["income", "expense"]),
});

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);

  const [openAccount, setOpenAccount] = useState(false);
  const [openTx, setOpenTx] = useState(false);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", type: "income", description: "" },
  });

  const txForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema) as Resolver<
      z.infer<typeof transactionSchema>
    >,
    defaultValues: {
      accountId: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
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

      const [accs, txs] = await Promise.all([
        getUserDocuments<Account>("accounts", user.uid),
        getUserDocuments<Transaction>("transactions", user.uid),
      ]);
      setAccounts(accs);

      // Sort transactions by date desc
      setTransactions(
        txs.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load accounts data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  async function onAccountSubmit(data: z.infer<typeof accountSchema>) {
    if (!user) return;
    try {
      if (editingAccount?.id) {
        await updateDocument<Account>("accounts", editingAccount.id, data);
        toast.success("Account updated");
      } else {
        await addDocument<Account>("accounts", {
          userId: user.uid,
          ...data,
          balance: 0,
        });
        toast.success("Account created");
      }
      setOpenAccount(false);
      accountForm.reset();
      fetchData();
    } catch (error) {
      toast.error("Failed to save account");
    }
  }

  async function onTxSubmit(data: z.infer<typeof transactionSchema>) {
    if (!user) return;
    try {
      const amount =
        data.type === "expense"
          ? -Math.abs(data.amount)
          : Math.abs(data.amount);
      if (editingTx?.id) {
        await updateDocument<Transaction>("transactions", editingTx.id, {
          ...data,
          amount,
        });
        toast.success("Transaction updated");
      } else {
        await addDocument<Transaction>("transactions", {
          userId: user.uid,
          ...data,
          amount,
        });
        toast.success("Transaction added");
      }
      setOpenTx(false);
      txForm.reset();
      fetchData();
    } catch (error) {
      toast.error("Failed to save transaction");
    }
  }

  function handleEditAccount(acc: Account) {
    setEditingAccount(acc);
    accountForm.reset({
      name: acc.name,
      type: acc.type,
      description: acc.description || "",
    });
    setOpenAccount(true);
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      await deleteDocument("accounts", id);
      toast.success("Account deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete account");
    }
  }

  function handleEditTx(tx: Transaction) {
    setEditingTx(tx);
    txForm.reset({
      accountId: tx.accountId,
      amount: Math.abs(tx.amount),
      date: tx.date,
      description: tx.description,
      type: tx.type,
    });
    setOpenTx(true);
  }

  async function handleDeleteTx(id: string) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await deleteDocument("transactions", id);
      toast.success("Transaction deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  }

  // Calculate balances per account based on transactions
  const accountBalances = accounts.map((acc) => {
    const accTxs = transactions.filter((t) => t.accountId === acc.id);
    const balance = accTxs.reduce((sum, t) => sum + t.amount, 0);
    return { ...acc, balance };
  });

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ledger & Accounts</h2>
        <p className="text-muted-foreground">
          Manage your sub-accounts and track internal transactions. All amounts
          in {baseCurrency}.
        </p>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openAccount} onOpenChange={setOpenAccount}>
              <DialogTrigger>
                <Button
                  onClick={() => {
                    setEditingAccount(null);
                    accountForm.reset({
                      name: "",
                      type: "income",
                      description: "",
                    });
                  }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingAccount ? "Edit Account" : "New Account"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...accountForm}>
                  <form
                    onSubmit={accountForm.handleSubmit(onAccountSubmit)}
                    className="space-y-4">
                    <FormField
                      control={accountForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Travel Expenses"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            items={[
                              { value: "income", label: "Income" },
                              { value: "expense", label: "Expense" },
                              { value: "asset", label: "Asset" },
                              { value: "liability", label: "Liability" },
                            ]}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="income">Income</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                              <SelectItem value="asset">Asset</SelectItem>
                              <SelectItem value="liability">
                                Liability
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      {editingAccount ? "Update Account" : "Save Account"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">
                    Balance ({baseCurrency})
                  </TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountBalances.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-muted-foreground">
                      No accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  accountBalances.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="capitalize">{acc.type}</TableCell>
                      <TableCell className="text-right font-mono">
                        {acc.balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditAccount(acc)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteAccount(acc.id!)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openTx} onOpenChange={setOpenTx}>
              <DialogTrigger>
                <Button
                  onClick={() => {
                    setEditingTx(null);
                    txForm.reset({
                      accountId: "",
                      amount: 0,
                      date: format(new Date(), "yyyy-MM-dd"),
                      description: "",
                      type: "expense",
                    });
                  }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTx ? "Edit Transaction" : "New Transaction"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...txForm}>
                  <form
                    onSubmit={txForm.handleSubmit(onTxSubmit)}
                    className="space-y-4">
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
                    <FormField
                      control={txForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Flight to NY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={txForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transaction Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            items={[
                              { value: "income", label: "Income (Deposit)" },
                              {
                                value: "expense",
                                label: "Expense (Withdrawal)",
                              },
                            ]}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="income">
                                Income (Deposit)
                              </SelectItem>
                              <SelectItem value="expense">
                                Expense (Withdrawal)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                              label: acc.name,
                            }))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id!}>
                                  {acc.name}
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
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      {editingTx ? "Update Transaction" : "Save Transaction"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">
                    Amount ({baseCurrency})
                  </TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        {accounts.find((a) => a.id === tx.accountId)?.name ||
                          "Unknown"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${tx.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTx(tx)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteTx(tx.id!)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
