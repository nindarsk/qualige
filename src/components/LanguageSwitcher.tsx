import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const languages = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ka", label: "ქართული", flag: "🇬🇪" },
];

interface LanguageSwitcherProps {
  variant?: "ghost" | "outline";
  className?: string;
}

const LanguageSwitcher = ({ variant = "ghost", className }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const switchLanguage = async (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("quali_language", code);

    // Save to profile if authenticated
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
        <Button variant={variant} size="sm" className={className}>
          <Globe className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLang.flag} {currentLang.label}
          </span>
          <span className="sm:hidden">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-accent/10 font-semibold" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
