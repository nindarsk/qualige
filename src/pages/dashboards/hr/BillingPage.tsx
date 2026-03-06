import { useEffect, useState } from "react";
import { Calendar, FileText, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PlanChangeModal from "@/components/PlanChangeModal";

interface OrgBilling {
  plan: string;
  plan_status: string;
  plan_started_at: string | null;
  plan_ends_at: string | null;
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

const BillingPage = () => {
  const { organizationId, organizationName, fullName, user } = useAuth();
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    const fetchBilling = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("plan, plan_status, plan_started_at, plan_ends_at")
        .eq("id", organizationId)
        .single();
      if (data) setBilling(data as OrgBilling);
      setLoading(false);
    };
    fetchBilling();
  }, [organizationId]);

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
        <p className="text-muted-foreground">View your current plan and request changes.</p>
      </div>

      {/* Plan overview */}
      <div className="grid gap-6 md:grid-cols-2">
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
      </div>

      {/* Action */}
      <div>
        <Button onClick={() => setModalOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Contact Us to Change Plan
        </Button>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Need Help?
          </CardTitle>
          <CardDescription>
            For billing questions, invoices, or custom pricing, contact us at{" "}
            <a href="mailto:hello@quali.ge" className="text-accent underline">
              hello@quali.ge
            </a>
          </CardDescription>
        </CardHeader>
      </Card>

      <PlanChangeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        organizationName={organizationName || ""}
        currentPlan={planLabels[plan] || plan}
        adminEmail={user?.email || ""}
        adminName={fullName || ""}
      />
    </div>
  );
};

export default BillingPage;
