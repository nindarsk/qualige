import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Upload } from "lucide-react";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "@/hooks/use-page-title";

interface OrgSettings {
  name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  industry: string;
  default_language: string;
  logo_url: string | null;
  notify_assignment: boolean;
  notify_reminder: boolean;
  notify_overdue: boolean;
  notify_completion: boolean;
}

const INDUSTRIES = ["Banking", "Insurance", "Microfinance", "Fintech", "Other"];
const LANGUAGES = ["English", "Georgian", "Russian"];

const SettingsPage = () => {
  const { organizationId } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<OrgSettings>({
    name: "",
    primary_contact_name: "",
    primary_contact_email: "",
    industry: "Other",
    default_language: "English",
    logo_url: null,
    notify_assignment: true,
    notify_reminder: true,
    notify_overdue: true,
    notify_completion: true,
  });

  useEffect(() => {
    if (organizationId) fetchSettings();
  }, [organizationId]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("name, primary_contact_name, primary_contact_email, industry, default_language, logo_url, notify_assignment, notify_reminder, notify_overdue, notify_completion")
      .eq("id", organizationId!)
      .single();

    if (data) {
      setSettings({
        name: data.name || "",
        primary_contact_name: (data as any).primary_contact_name || "",
        primary_contact_email: (data as any).primary_contact_email || "",
        industry: (data as any).industry || "Other",
        default_language: (data as any).default_language || "English",
        logo_url: (data as any).logo_url || null,
        notify_assignment: (data as any).notify_assignment ?? true,
        notify_reminder: (data as any).notify_reminder ?? true,
        notify_overdue: (data as any).notify_overdue ?? true,
        notify_completion: (data as any).notify_completion ?? true,
      });
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max logo size is 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${organizationId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
      setSettings((s) => ({ ...s, logo_url: urlData.publicUrl }));
      toast({ title: "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: settings.name,
        primary_contact_name: settings.primary_contact_name,
        primary_contact_email: settings.primary_contact_email,
        industry: settings.industry,
        default_language: settings.default_language,
        logo_url: settings.logo_url,
        notify_assignment: settings.notify_assignment,
        notify_reminder: settings.notify_reminder,
        notify_overdue: settings.notify_overdue,
        notify_completion: settings.notify_completion,
      } as any)
      .eq("id", organizationId!);

    if (error) {
      toast({ title: "Failed to save settings. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Settings saved successfully" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization's profile and preferences.</p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <Input value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <Label>Primary Contact Name</Label>
            <Input value={settings.primary_contact_name} onChange={(e) => setSettings((s) => ({ ...s, primary_contact_name: e.target.value }))} />
          </div>
          <div>
            <Label>Primary Contact Email</Label>
            <Input type="email" value={settings.primary_contact_email} onChange={(e) => setSettings((s) => ({ ...s, primary_contact_email: e.target.value }))} />
          </div>
          <div>
            <Label>Industry</Label>
            <Select value={settings.industry} onValueChange={(v) => setSettings((s) => ({ ...s, industry: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Default Language</Label>
            <Select value={settings.default_language} onValueChange={(v) => setSettings((s) => ({ ...s, default_language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Logo</CardTitle>
          <CardDescription>Upload your company logo (max 2MB).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {settings.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-contain border border-border" />
            )}
            <div>
              <Button variant="outline" asChild disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploading ? "Uploading..." : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Control which notifications are sent to employees.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "notify_assignment" as const, label: "Course Assignment", desc: "Email when a course is assigned" },
            { key: "notify_reminder" as const, label: "Due Date Reminders", desc: "Reminders before deadline" },
            { key: "notify_overdue" as const, label: "Overdue Alerts", desc: "Alert when training is past due" },
            { key: "notify_completion" as const, label: "Completion Confirmation", desc: "Email on course completion" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [item.key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? t("settings.saving") : t("settings.saveSettings")}
      </Button>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup />
    </div>
  );
};

export default SettingsPage;
