"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { Invoice, BusinessProfile, Customer } from "@/lib/firebase/db";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: "Helvetica", color: "#333" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  companyName: { fontSize: 24, fontWeight: "bold", color: "#000" },
  invoiceTitle: { fontSize: 28, color: "#cbd5e1" },
  section: { marginBottom: 20 },
  label: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bold: { fontWeight: "bold" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  table: { width: "100%", marginTop: 20 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 2, textAlign: "right" },
  colTax: { flex: 1, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  totalsContainer: { marginTop: 20, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotal: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 4,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#94a3b8",
  },
});

interface InvoicePDFProps {
  invoice: Invoice;
  business: BusinessProfile;
  customer: Customer;
}

export function InvoicePDF({ invoice, business, customer }: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{business.companyName}</Text>
            <Text>{business.address}</Text>
            {business.gstNumber && <Text>GST: {business.gstNumber}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text>#{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 30,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Bill To:</Text>
            <Text style={styles.bold}>{customer.name}</Text>
            <Text>{customer.billingAddress}</Text>
            {customer.gstNumber && <Text>GST: {customer.gstNumber}</Text>}
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <View style={styles.row}>
              <Text style={styles.label}>Date: </Text>
              <Text>{format(new Date(invoice.date), "dd MMM yyyy")}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Due Date: </Text>
              <Text>{format(new Date(invoice.dueDate), "dd MMM yyyy")}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTax}>Tax %</Text>
            <Text style={styles.colTotal}>Amount</Text>
          </View>

          {invoice.items.map((item, idx) => {
            const amount = item.quantity * item.unitPrice;
            const taxAmount = amount * (item.taxRate / 100);
            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colDesc}>{item.description}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{item.unitPrice.toFixed(2)}</Text>
                <Text style={styles.colTax}>{item.taxRate}%</Text>
                <Text style={styles.colTotal}>
                  {(amount + taxAmount).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>
              {invoice.subTotal.toFixed(2)} {invoice.currency}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Tax Total</Text>
            <Text>
              {invoice.taxTotal.toFixed(2)} {invoice.currency}
            </Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>
              {invoice.total.toFixed(2)} {invoice.currency}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
}
