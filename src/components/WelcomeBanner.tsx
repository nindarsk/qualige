import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const WelcomeBanner = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("welcome_banner_dismissed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data && !data.welcome_banner_dismissed) {
          setVisible(true);
        }
      });
  }, [user]);

  const dismiss = async () => {
    setVisible(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ welcome_banner_dismissed: true })
        .eq("user_id", user.id);
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-[10px] border border-border p-4">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{t("welcome.title")}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("welcome.message")}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismiss}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default WelcomeBanner;
