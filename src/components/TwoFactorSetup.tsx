import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";

const TwoFactorSetup = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  // Check current MFA status
  useState(() => {
    const checkMFA = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const verified = data?.totp?.filter(f => f.status === 'verified') || [];
        setEnabled(verified.length > 0);
      } catch (e) {
        console.error("MFA check error:", e);
      }
      setLoading(false);
    };
    checkMFA();
  });

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      toast({ title: t("twoFactor.enrollFailed"), description: err.message, variant: "destructive" });
    }
    setEnrolling(false);
  };

  const verifyAndEnable = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setEnabled(true);
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setVerifyCode("");
      toast({ title: t("twoFactor.enabledSuccess") });
    } catch (err: any) {
      toast({ title: t("twoFactor.invalidCode"), description: err.message, variant: "destructive" });
    }
    setVerifying(false);
  };

  const disableMFA = async () => {
    if (disableCode.length !== 6) return;
    setDisabling(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.find(f => f.status === 'verified');
      if (!factor) throw new Error("No verified factor found");

      // Verify code first
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      // Unenroll
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (unenrollError) throw unenrollError;

      setEnabled(false);
      setShowDisableDialog(false);
      setDisableCode("");
      toast({ title: t("twoFactor.disabledSuccess") });
    } catch (err: any) {
      toast({ title: t("twoFactor.invalidCode"), description: err.message, variant: "destructive" });
    }
    setDisabling(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t("twoFactor.title")}
              </CardTitle>
              <CardDescription>{t("twoFactor.description")}</CardDescription>
            </div>
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? t("twoFactor.enabled") : t("twoFactor.notEnabled")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!enabled && !qrCode && (
            <Button onClick={startEnrollment} disabled={enrolling}>
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t("twoFactor.enable")}
            </Button>
          )}

          {qrCode && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-4">{t("twoFactor.scanQR")}</p>
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code" className="h-48 w-48 rounded-lg border border-border" />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("twoFactor.manualEntry")}</p>
                <code className="block rounded bg-muted px-3 py-2 text-sm font-mono break-all">{secret}</code>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t("twoFactor.enterCode")}</p>
                <div className="flex gap-3">
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="max-w-[160px] text-center text-lg font-mono tracking-widest"
                  />
                  <Button onClick={verifyAndEnable} disabled={verifyCode.length !== 6 || verifying}>
                    {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("twoFactor.verify")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {enabled && (
            <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
              <ShieldOff className="mr-2 h-4 w-4" />
              {t("twoFactor.disable")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("twoFactor.disableTitle")}</DialogTitle>
            <DialogDescription>{t("twoFactor.disableDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={disableMFA} disabled={disableCode.length !== 6 || disabling}>
                {disabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("twoFactor.confirmDisable")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorSetup;
