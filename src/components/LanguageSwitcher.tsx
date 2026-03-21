import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const languages = [
  { code: "en", label: "English", short: "EN" },
  { code: "ka", label: "ქართული", short: "KA" },
  { code: "ru", label: "Русский", short: "RU" },
];

interface LanguageSwitcherProps {
  variant?: "ghost" | "outline";
  className?: string;
}

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const switchLanguage = async (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("quali_language", code);

    if (user) {
      await supabase
        .from("profiles")
        .update({ language: code } as any)
        .eq("user_id", user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors h-8 ${className || ""}`}
        >
          {currentLang.short}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-accent/10 font-semibold" : ""}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
