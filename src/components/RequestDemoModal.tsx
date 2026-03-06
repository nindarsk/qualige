import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RequestDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  billingCycle: "monthly" | "annual";
}

const RequestDemoModal = ({ open, onOpenChange, planName, billingCycle }: RequestDemoModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    organizationName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    if (!form.organizationName.trim()) errs.organizationName = "Organization name is required";
    if (!form.email.trim()) errs.email = "Work email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email address";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-demo-request", {
        body: {
          type: "demo_request",
          fullName: form.fullName.trim(),
          organizationName: form.organizationName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
          planName,
          billingCycle,
        },
      });

      if (error) throw error;

      toast({ title: "Thank you!", description: "We will be in touch within 24 hours." });
      onOpenChange(false);
      setForm({ fullName: "", organizationName: "", email: "", phone: "", message: "" });
      setErrors({});
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

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Demo — {planName} Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="demo-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input id="demo-name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} maxLength={200} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-org">
              Organization Name <span className="text-destructive">*</span>
            </Label>
            <Input id="demo-org" value={form.organizationName} onChange={(e) => update("organizationName", e.target.value)} maxLength={200} />
            {errors.organizationName && <p className="text-sm text-destructive">{errors.organizationName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-email">
              Work Email <span className="text-destructive">*</span>
            </Label>
            <Input id="demo-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={255} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-phone">Phone Number</Label>
            <Input id="demo-phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-msg">Message</Label>
            <Textarea id="demo-msg" placeholder="Tell us about your training needs" value={form.message} onChange={(e) => update("message", e.target.value)} maxLength={2000} />
          </div>
          <Button type="submit" className="w-full gradient-gold border-0 text-accent-foreground hover:opacity-90" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDemoModal;
