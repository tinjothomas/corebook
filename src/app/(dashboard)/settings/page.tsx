"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { getDocument, setDocument, BusinessProfile } from "@/lib/firebase/db";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters."),
  address: z.string().min(5, "Please enter a valid address."),
  gstNumber: z.string().optional(),
  baseCurrency: z.string().min(3, "Please select a currency."),
});

type FormValues = z.infer<typeof formSchema>;

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"];

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      address: "",
      gstNumber: "",
      baseCurrency: "INR",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      try {
        const profile = await getDocument<BusinessProfile>(
          "businesses",
          user.uid,
        );
        if (profile) {
          form.reset({
            companyName: profile.companyName,
            address: profile.address,
            gstNumber: profile.gstNumber || "",
            baseCurrency: profile.baseCurrency,
          });
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        toast.error("Failed to load business profile");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user, form]);

  async function onSubmit(data: FormValues) {
    if (!user) return;
    try {
      await setDocument<BusinessProfile>("businesses", user.uid, {
        userId: user.uid,
        ...data,
      });
      toast.success("Business profile updated successfully");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Profile</h3>
        <p className="text-sm text-muted-foreground">
          Update your company details and default accounting settings.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Corp" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="123 Business St, City, Country"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gstNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST / Tax Number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 22AAAAA0000A1Z5" {...field} />
                </FormControl>
                <FormDescription>
                  This will be displayed on your invoices automatically.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="baseCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Accounting Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The currency used for your internal sub-accounts and balance
                  sheet.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Save Changes</Button>
        </form>
      </Form>
    </div>
  );
}
