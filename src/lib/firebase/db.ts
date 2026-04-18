import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  DocumentData,
  QueryConstraint
} from "firebase/firestore";
import { db } from "./config";

// --- Types ---
export interface BusinessProfile {
  id?: string;
  userId: string;
  companyName: string;
  address: string;
  gstNumber?: string;
  baseCurrency: string;
  logoUrl?: string;
}

export interface Customer {
  id?: string;
  userId: string;
  name: string;
  email: string;
  billingAddress: string;
  gstNumber?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // e.g., 18 for 18%
}

export interface Invoice {
  id?: string;
  userId: string;
  customerId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  currency: string;
  items: InvoiceItem[];
  subTotal: number;
  taxTotal: number;
  total: number;
  status: "draft" | "sent" | "paid";
  paidAmount?: number;
  tdsDeducted?: number;
  paymentDate?: string;
  accountId?: string; // which sub-account this was paid into
}

export interface Account {
  id?: string;
  userId: string;
  name: string;
  type: "income" | "expense" | "asset" | "liability";
  description?: string;
  balance: number; // Managed loosely or computed
}

export interface TransactionCategory {
  id?: string;
  userId: string;
  name: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  amount: number; // positive for income/increase, negative for expense/decrease
  date: string;
  description: string;
  type: "income" | "expense";
  referenceType?: "invoice";
  referenceId?: string; // e.g., invoiceId
}

// --- Helpers ---

// Generic fetch all for a user
export async function getUserDocuments<T>(colName: string, userId: string, extraConstraints: QueryConstraint[] = []): Promise<T[]> {
  const q = query(collection(db, colName), where("userId", "==", userId), ...extraConstraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T));
}

// Generic get one
export async function getDocument<T>(colName: string, docId: string): Promise<T | null> {
  const docRef = doc(db, colName, docId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as unknown as T;
  }
  return null;
}

// Generic add
export async function addDocument<T extends DocumentData>(colName: string, data: Omit<T, "id">): Promise<string> {
  const docRef = await addDoc(collection(db, colName), data);
  return docRef.id;
}

// Generic update
export async function updateDocument<T>(colName: string, docId: string, data: Partial<T>): Promise<void> {
  const docRef = doc(db, colName, docId);
  await updateDoc(docRef, data as any);
}

// Generic delete
export async function deleteDocument(colName: string, docId: string): Promise<void> {
  const docRef = doc(db, colName, docId);
  await deleteDoc(docRef);
}

// Set document with specific ID (useful for singleton like business profile)
export async function setDocument<T extends DocumentData>(colName: string, docId: string, data: Omit<T, "id">): Promise<void> {
  const docRef = doc(db, colName, docId);
  await setDoc(docRef, data);
}
