"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserDocuments,
  deleteDocument,
  Account,
  Transaction,
  TransactionCategory,
  BusinessProfile,
  getDocument,
} from "@/lib/firebase/db";
import { toast } from "sonner";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Search, X, Filter } from "lucide-react";

export default function TransactionsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    if (!user) return;
    try {
      const profile = await getDocument<BusinessProfile>("businesses", user.uid);
      if (profile) setBaseCurrency(profile.baseCurrency || "USD");

      const [accs, txs, cats] = await Promise.all([
        getUserDocuments<Account>("accounts", user.uid),
        getUserDocuments<Transaction>("transactions", user.uid),
        getUserDocuments<TransactionCategory>("transactionCategories", user.uid),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(
        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedAccount("all");
    setSelectedCategory("all");
    setSelectedType("all");
    setStartDate("");
    setEndDate("");
  };

  // Filtered transactions computation
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Text Search Filter (on description)
      if (
        searchTerm &&
        !tx.description.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // 2. Account Filter
      if (selectedAccount !== "all" && tx.accountId !== selectedAccount) {
        return false;
      }

      // 3. Category Filter
      if (selectedCategory !== "all") {
        if (selectedCategory === "none" && tx.categoryId) {
          return false;
        }
        if (selectedCategory !== "none" && tx.categoryId !== selectedCategory) {
          return false;
        }
      }

      // 4. Type Filter
      if (selectedType !== "all" && tx.type !== selectedType) {
        return false;
      }

      // 5. Date Range Filter
      if (startDate || endDate) {
        try {
          const txDate = parseISO(tx.date);
          const start = startDate ? startOfDay(parseISO(startDate)) : null;
          const end = endDate ? endOfDay(parseISO(endDate)) : null;

          if (start && txDate < start) return false;
          if (end && txDate > end) return false;
        } catch (e) {
          console.error("Date parsing error", e);
        }
      }

      return true;
    });
  }, [transactions, searchTerm, selectedAccount, selectedCategory, selectedType, startDate, endDate]);

  // Filtered totals
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        expense += Math.abs(tx.amount);
      }
    });
    return {
      income,
      expense,
      net: income - expense,
    };
  }, [filteredTransactions]);

  const currencySymbol = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: baseCurrency,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value || "$";
  }, [baseCurrency]);

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

  if (loading) {
    return (
      <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute py-8">
        Balancing books · Please wait
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="font-serif text-[42px] leading-tight tracking-tight">Ledger Registry</h2>
        <p className="text-[13px] text-ink-soft mt-1">
          Historical record of all sub-account transactions. Use controls to filter index.
        </p>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-card border-[0.5px] border-line p-6 space-y-6">
        <div className="flex items-center justify-between border-b-[0.5px] border-line-soft pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-mute" />
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink font-semibold">Registry Filters</h3>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-[10px] uppercase tracking-[0.14em] text-rose hover:text-rose-soft border-b-[0.5px] border-rose/30 pb-[2px] transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Text Search */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
              Search Description
            </label>
            <div className="relative">
              <Search className="absolute left-0 top-2.5 h-3.5 w-3.5 text-ink-mute" />
              <input
                type="text"
                placeholder="e.g. Office Supplies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] pl-6 text-[14px] text-ink focus:outline-none focus:border-ink transition-colors placeholder:text-ink-mute/40"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-0 top-2 text-ink-soft hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
              Sub-Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[14px] text-ink focus:outline-none focus:border-ink transition-colors appearance-none"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id!}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[14px] text-ink focus:outline-none focus:border-ink transition-colors appearance-none"
            >
              <option value="all">All Categories</option>
              <option value="none">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id!}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
              Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[14px] text-ink focus:outline-none focus:border-ink transition-colors appearance-none"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
            </select>
          </div>

          {/* Date Picker Range */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[13px] text-ink focus:outline-none focus:border-ink transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-[6px]">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent border-b-[0.5px] border-line pb-[10px] text-[13px] text-ink focus:outline-none focus:border-ink transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Summary Metrics Panel */}
      <div className="grid grid-cols-3 border-[0.5px] border-line bg-card divide-x-[0.5px] divide-line">
        <div className="p-[18px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[5px] h-[5px] bg-moss rounded-full"></div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              Filtered Income
            </div>
          </div>
          <div className="font-serif text-[26px] tabular-nums">
            <span className="text-[16px] text-ink-mute mr-0.5">{currencySymbol}</span>
            {filteredTotals.income.toFixed(2)}
          </div>
        </div>
        <div className="p-[18px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[5px] h-[5px] bg-rose rounded-full"></div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              Filtered Expense
            </div>
          </div>
          <div className="font-serif text-[26px] tabular-nums">
            <span className="text-[16px] text-ink-mute mr-0.5">{currencySymbol}</span>
            {filteredTotals.expense.toFixed(2)}
          </div>
        </div>
        <div className="p-[18px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[5px] h-[5px] bg-gold rounded-full"></div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              Filtered Net Margin
            </div>
          </div>
          <div className="font-serif text-[26px] tabular-nums">
            <span className="text-[16px] text-ink-mute mr-0.5">{currencySymbol}</span>
            {filteredTotals.net.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Ledger History List */}
      <div className="border-[0.5px] border-line bg-card p-6">
        <div className="flex justify-between items-center mb-6 border-b-[0.5px] border-line-soft pb-4">
          <h3 className="font-serif text-[22px]">Index Matches</h3>
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
            Showing {filteredTransactions.length} of {transactions.length} records
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-[13px] text-ink-soft py-8 text-center italic">
            No records match filters.
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredTransactions.map((tx) => {
              const date = new Date(tx.date);
              const month = format(date, "MMM");
              const day = format(date, "dd");
              const isIncome = tx.amount > 0;
              const account = accounts.find((a) => a.id === tx.accountId);
              const category = categories.find((c) => c.id === tx.categoryId);

              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-[52px_1fr_auto_auto] gap-3 py-3 border-b-[0.5px] border-line-soft hover:bg-paper-warm group transition-colors px-2 -mx-2"
                >
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
                    className={`font-serif text-[18px] tabular-nums flex items-center ${
                      isIncome ? "text-moss" : "text-ink"
                    }`}
                  >
                    {isIncome ? "+" : "−"} {Math.abs(tx.amount).toFixed(2)}
                  </div>
                  <div className="flex items-center justify-end w-32 gap-3">
                    <div
                      className={`px-2 py-[3px] text-[10px] uppercase tracking-[0.1em] border-[0.5px] rounded-[1px] ${
                        isIncome ? "border-moss bg-moss-soft text-moss" : "border-ink bg-paper text-ink"
                      }`}
                    >
                      {isIncome ? "INCOME" : "EXPENSE"}
                    </div>
                    <button
                      onClick={() => handleDeleteTx(tx.id!)}
                      className="text-ink-soft hover:text-rose transition-colors"
                      title="Delete Transaction"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
  );
}
