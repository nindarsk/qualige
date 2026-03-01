import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const WelcomeBanner = () => {
  const { user } = useAuth();
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
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium text-foreground">Welcome to Quali.ge!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your training courses are shown below. Complete each course and pass the quiz to receive your certificate.
        </p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default WelcomeBanner;
