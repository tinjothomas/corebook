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
  TransactionCategory,
} from "@/lib/firebase/db";
import { toast } from "sonner";
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
  categoryId: z.string().optional(),
});

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

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
      categoryId: "none",
    },
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", type: "asset", description: "" },
  });

  const fetchData = async () => {
    if (!user) return;
    try {
      const profile = await getDocument<BusinessProfile>(
        "businesses",
        user.uid,
      );
      if (profile) setBaseCurrency(profile.baseCurrency || "USD");

      const [accs, txs, cats] = await Promise.all([
        getUserDocuments<Account>("accounts", user.uid),
        getUserDocuments<Transaction>("transactions", user.uid),
        getUserDocuments<TransactionCategory>(
          "transactionCategories",
          user.uid,
        ),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(
        txs.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load data");
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

      const submissionData = {
        ...data,
        categoryId: data.categoryId === "none" ? undefined : data.categoryId,
        amount,
      };

      if (editingTx?.id) {
        await updateDocument<Transaction>(
          "transactions",
          editingTx.id,
          submissionData,
        );
        toast.success("Transaction updated");
      } else {
        await addDocument<Transaction>("transactions", {
          userId: user.uid,
          ...submissionData,
        });
        toast.success("Transaction recorded");
      }
      txForm.reset();
      setEditingTx(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to save transaction");
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
      categoryId: tx.categoryId || "none",
    });
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEditTx() {
    setEditingTx(null);
    txForm.reset({
      accountId: "",
      amount: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      type: "expense",
      categoryId: "none",
    });
  }

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
      setIsAddingAccount(false);
      setEditingAccount(null);
      accountForm.reset();
      fetchData();
    } catch (error) {
      toast.error("Failed to save account");
    }
  }

  async function handleDeleteTx(id: string) {
    if (!confirm("Delete this record?")) return;
    try {
      await deleteDocument("transactions", id);
      toast.success("Record expunged");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  }

  const accountBalances = accounts.map((acc) => {
    const accTxs = transactions.filter((t) => t.accountId === acc.id);
    const balance = accTxs.reduce((sum, t) => sum + t.amount, 0);
    return { ...acc, balance };
  });

  const totalBalance = accountBalances.reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const net = totalIncome - totalExpense;

  const currencySymbol =
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value || "$";

  if (loading) {
    return (
      <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute py-8">
        Balancing books · Please wait
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-[28px]">
      {/* Left Column: Main Content */}
      <div>
        {/* Hero Figure */}
        <div className="mb-6 pb-6 border-b-[0.5px] border-line">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute mb-2.5">
            Total Balance
          </div>
          <div className="font-serif text-[60px] leading-none tracking-[-0.025em] tabular-nums">
            <span className="text-[36px] text-ink-mute mr-1">
              {currencySymbol}
            </span>
            {totalBalance.toFixed(2)}
          </div>
          <div className="text-[13px] text-ink mt-2">
            {net >= 0 ? "▲" : "▼"} {Math.abs(net).toFixed(2)} net change this
            period
          </div>
        </div>

        {/* KPI Trio */}
        <div className="grid grid-cols-3 border-[0.5px] border-line bg-card mb-7 divide-x-[0.5px] divide-line">
          <div className="p-[18px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-[5px] h-[5px] bg-moss rounded-full"></div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                Income
              </div>
            </div>
            <div className="font-serif text-[26px] tabular-nums">
              {totalIncome.toFixed(2)}
            </div>
          </div>
          <div className="p-[18px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-[5px] h-[5px] bg-rose rounded-full"></div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                Expense
              </div>
            </div>
            <div className="font-serif text-[26px] tabular-nums">
              {totalExpense.toFixed(2)}
            </div>
          </div>
          <div className="p-[18px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-[5px] h-[5px] bg-gold rounded-full"></div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                Net Margin
              </div>
            </div>
            <div className="font-serif text-[26px] tabular-nums">
              {net.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Transactions Section */}
        <div>
          <h3 className="font-serif text-[26px] mb-4">Ledger</h3>
          {transactions.length === 0 ? (
            <div className="text-[13px] text-ink-soft py-4">
              No records found.
            </div>
          ) : (
            <div className="flex flex-col">
              {transactions.map((tx, idx) => {
                const date = new Date(tx.date);
                const month = format(date, "MMM");
                const day = format(date, "dd");
                const isIncome = tx.amount > 0;
                const account = accounts.find((a) => a.id === tx.accountId);
                const category = categories.find((c) => c.id === tx.categoryId);

                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[52px_1fr_auto_auto] gap-3 py-3 border-b-[0.5px] border-line-soft hover:bg-paper-warm group transition-colors px-2 -mx-2">
                    <div className="flex flex-col items-center justify-center border-r-[0.5px] border-line pr-3">
                      <span className="font-serif text-[11px] uppercase text-ink-soft">
                        {month}
                      </span>
                      <span className="font-serif text-[18px] tabular-nums leading-none">
                        {day}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="text-[14px]">{tx.description}</div>
                      <div className="flex gap-2 mt-1">
                        <div className="text-[10px] uppercase tracking-[0.14em] px-2 py-[2px] bg-paper-warm text-ink-soft w-fit rounded-[1px]">
                          {account?.name || "Unknown"}
                        </div>
                        {category && (
                          <div className="text-[10px] uppercase tracking-[0.14em] px-2 py-[2px] bg-paper-warm text-ink-soft w-fit rounded-[1px]">
                            {category.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`font-serif text-[18px] tabular-nums flex items-center ${isIncome ? "text-moss" : "text-ink"}`}>
                      {isIncome ? "+" : "−"} {Math.abs(tx.amount).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-end w-32 gap-2">
                      <div
                        className={`px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] border-[0.5px] rounded-[1px] ${isIncome ? "border-moss bg-moss-soft text-moss" : "border-ink bg-paper text-ink"}`}>
                        {isIncome ? "INCOME" : "EXPENSE"}
                      </div>
                      <button
                        onClick={() => handleEditTx(tx)}
                        className="text-ink-soft hover:text-ink transition-colors px-2"
                        title="Edit Transaction">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTx(tx.id!)}
                        className="text-ink-soft hover:text-rose transition-colors"
                        title="Delete Transaction">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Sidebar */}
      <div>
        {/* Dark Invitation - Quick Add */}
        <div className="bg-ink text-paper p-[22px] relative mb-7">
          <div className="absolute top-[22px] right-[22px] w-[26px] h-[26px] border-[0.5px] border-paper/25 rounded-full flex items-center justify-center text-[18px] font-light">
            +
          </div>
          <h3 className="font-serif text-[26px] mb-6">
            {editingTx ? "Edit Transaction" : "Quick Add"}
          </h3>

          <form
            onSubmit={txForm.handleSubmit(onTxSubmit)}
            className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                Date
              </label>
              <input
                type="date"
                {...txForm.register("date")}
                className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] text-[14px] text-paper focus:outline-none focus:border-paper transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                Description
              </label>
              <input
                type="text"
                placeholder="e.g. Office Supplies"
                {...txForm.register("description")}
                className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] text-[14px] text-paper focus:outline-none focus:border-paper transition-colors placeholder:text-paper/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                  Type
                </label>
                <select
                  {...txForm.register("type")}
                  className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] text-[14px] text-paper focus:outline-none focus:border-paper transition-colors appearance-none">
                  <option value="expense" className="bg-ink text-paper">
                    Expense
                  </option>
                  <option value="income" className="bg-ink text-paper">
                    Income
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                  Account
                </label>
                <select
                  {...txForm.register("accountId")}
                  className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] text-[14px] text-paper focus:outline-none focus:border-paper transition-colors appearance-none">
                  <option value="" className="bg-ink text-paper/50">
                    Select...
                  </option>
                  {accounts.map((acc) => (
                    <option
                      key={acc.id}
                      value={acc.id!}
                      className="bg-ink text-paper">
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                Category
              </label>
              <select
                {...txForm.register("categoryId")}
                className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] text-[14px] text-paper focus:outline-none focus:border-paper transition-colors appearance-none">
                <option value="none" className="bg-ink text-paper/50">
                  None
                </option>
                {categories.map((cat) => (
                  <option
                    key={cat.id}
                    value={cat.id!}
                    className="bg-ink text-paper">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-paper/55 mb-[5px]">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-0 top-0 text-paper/55 font-serif text-[22px]">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  {...txForm.register("amount")}
                  className="w-full bg-transparent border-b-[0.5px] border-paper/25 pb-[10px] pl-[18px] text-[22px] font-serif tabular-nums text-paper focus:outline-none focus:border-paper transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className={`flex-1 bg-paper text-ink border-[0.5px] border-ink py-[12px] text-[11px] uppercase tracking-[0.16em] hover:bg-paper-warm transition-colors`}>
                {editingTx ? "Update" : "Record"}
              </button>
              {editingTx && (
                <button
                  type="button"
                  onClick={handleCancelEditTx}
                  className="flex-1 bg-transparent text-paper border-[0.5px] border-paper py-[12px] text-[11px] uppercase tracking-[0.16em] hover:bg-paper/10 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Passive Card - Accounts List */}
        <div className="bg-card border-[0.5px] border-line p-[22px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif text-[22px]">Accounts</h3>
            <button
              onClick={() => setIsAddingAccount(true)}
              className="text-[11px] uppercase tracking-[0.16em] text-ink-soft border-b-[0.5px] border-ink-mute pb-[2px] hover:text-ink hover:border-ink transition-colors">
              New →
            </button>
          </div>

          {isAddingAccount && (
            <div className="mb-6 pb-6 border-b-[0.5px] border-line-soft">
              <form
                onSubmit={accountForm.handleSubmit(onAccountSubmit)}
                className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[5px]">
                    Account Name
                  </label>
                  <input
                    type="text"
                    {...accountForm.register("name")}
                    className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[14px] focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[5px]">
                    Type
                  </label>
                  <select
                    {...accountForm.register("type")}
                    className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[14px] focus:outline-none focus:border-ink transition-colors">
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-ink text-paper border-[0.5px] border-ink py-[10px] text-[11px] uppercase tracking-[0.16em]">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingAccount(false)}
                    className="flex-1 border-[0.5px] border-line py-[10px] text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {accountBalances.length === 0 ? (
              <div className="text-[13px] text-ink-soft">
                No accounts created yet.
              </div>
            ) : (
              accountBalances.map((acc) => (
                <div
                  key={acc.id}
                  className="flex justify-between items-baseline border-b-[0.5px] border-line-soft pb-2 last:border-0">
                  <div>
                    <div className="text-[14px]">{acc.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                      {acc.type}
                    </div>
                  </div>
                  <div className="font-serif text-[18px] tabular-nums">
                    {acc.balance.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
