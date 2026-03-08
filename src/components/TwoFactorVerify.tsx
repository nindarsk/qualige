import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TwoFactorVerifyProps {
  factorId: string;
  onVerified: () => void;
}

const TwoFactorVerify = ({ factorId, onVerified }: TwoFactorVerifyProps) => {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (err: any) {
      setError(t("twoFactor.invalidCode"));
      setCode("");
    }
    setVerifying(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-accent" />
            <span className="text-xl font-bold text-primary">Quali</span>
          </div>
        </div>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("twoFactor.enterAuthCode")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("twoFactor.openAuthApp")}</p>
        </div>

        <Input
          value={code}
          onChange={(e) => {
            setError("");
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
          }}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          maxLength={6}
          className="text-center text-2xl font-mono tracking-[0.5em] h-14"
          autoFocus
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleVerify}
          disabled={code.length !== 6 || verifying}
          className="w-full"
        >
          {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("twoFactor.verify")}
        </Button>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
