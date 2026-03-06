import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PlanChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  currentPlan: string;
  adminEmail: string;
  adminName: string;
}

const actions = [
  { value: "upgrade", label: "Upgrade my plan" },
  { value: "downgrade", label: "Downgrade my plan" },
  { value: "cancel", label: "Cancel my subscription" },
  { value: "custom", label: "Get a custom quote" },
];

const PlanChangeModal = ({ open, onOpenChange, organizationName, currentPlan, adminEmail, adminName }: PlanChangeModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) {
      setActionError("Please select an action");
      return;
    }

    setLoading(true);
    try {
      const selectedLabel = actions.find((a) => a.value === action)?.label || action;
      const { error } = await supabase.functions.invoke("send-demo-request", {
        body: {
          type: "plan_change",
          fullName: adminName,
          organizationName,
          email: adminEmail,
          currentPlan,
          requestedAction: selectedLabel,
          message: message.trim() || undefined,
        },
      });

      if (error) throw error;

      toast({ title: "Request received!", description: "We will contact you within 24 hours." });
      onOpenChange(false);
      setAction("");
      setMessage("");
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please email us directly at hello@quali.ge",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Change Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Input value={organizationName} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Current Plan</Label>
            <Input value={currentPlan} readOnly className="bg-muted capitalize" />
          </div>
          <div className="space-y-1.5">
            <Label>HR Admin Email</Label>
            <Input value={adminEmail} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-action">
              I would like to <span className="text-destructive">*</span>
            </Label>
            <Select value={action} onValueChange={(v) => { setAction(v); setActionError(""); }}>
              <SelectTrigger id="plan-action">
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                {actions.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-msg">Additional Notes</Label>
            <Textarea id="plan-msg" placeholder="Any additional details..." value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanChangeModal;
