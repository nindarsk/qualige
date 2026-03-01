import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Calendar, FileText, ExternalLink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrgBilling {
  plan: string;
  plan_status: string;
  plan_started_at: string | null;
  plan_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const planLabels: Record<string, string> = {
  pilot: "Pilot (Free Trial)",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

const planPrices: Record<string, number> = {
  starter: 149,
  growth: 349,
  scale: 699,
  pilot: 0,
};

const mockInvoices = [
  { id: "INV-001", date: "2026-02-01", amount: 349, status: "Paid" },
  { id: "INV-002", date: "2026-01-01", amount: 349, status: "Paid" },
  { id: "INV-003", date: "2025-12-01", amount: 349, status: "Paid" },
];

const BillingPage = () => {
  const { organizationId } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [loading, setLoading] = useState(true);

  const success = searchParams.get("success") === "true";

  useEffect(() => {
    if (success) {
      toast({ title: "Payment Successful!", description: "Your subscription is now active." });
    }
  }, [success]);

  useEffect(() => {
    if (!organizationId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("plan, plan_status, plan_started_at, plan_ends_at, stripe_customer_id, stripe_subscription_id")
        .eq("id", organizationId)
        .single();
      if (data) setBilling(data as OrgBilling);
      setLoading(false);
    };
    fetch();
  }, [organizationId]);

  const handlePortal = () => {
    toast({ title: "Coming Soon", description: "Stripe Customer Portal integration will be available shortly." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Loading billing information…</p>
      </div>
    );
  }

  const plan = billing?.plan || "pilot";
  const status = billing?.plan_status || "active";
  const nextBilling = billing?.plan_ends_at
    ? new Date(billing.plan_ends_at).toLocaleDateString()
    : plan === "pilot"
    ? "N/A — Pilot"
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, payment method, and invoices.</p>
      </div>

      {status === "cancelled" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Your subscription has ended.</p>
            <p className="text-sm text-muted-foreground">
              Renew your plan to continue creating courses.
            </p>
          </div>
          <Button size="sm" className="ml-auto gradient-gold border-0 text-accent-foreground" asChild>
            <a href="/pricing">View Plans</a>
          </Button>
        </div>
      )}

      {/* Plan overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Plan</CardDescription>
            <CardTitle className="text-xl">{planLabels[plan] || plan}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status === "active" ? "default" : "destructive"} className="capitalize">
              {status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Amount</CardDescription>
            <CardTitle className="text-xl">${planPrices[plan] ?? 0}/mo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Next billing: {nextBilling}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payment Method</CardDescription>
            <CardTitle className="text-xl flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              {billing?.stripe_customer_id ? "•••• 4242" : "No card on file"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handlePortal}>
              Update
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handlePortal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Upgrade / Downgrade
        </Button>
        <Button variant="outline" onClick={handlePortal}>
          Cancel Subscription
        </Button>
      </div>

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>Past invoices and receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>{inv.date}</TableCell>
                  <TableCell>${inv.amount}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "Coming Soon", description: "Invoice download will be available with Stripe integration." })}>
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPage;
