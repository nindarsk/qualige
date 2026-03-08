import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} | Quali.ge`
      : "Quali.ge — AI Learning Management System";
  }, [title]);
}
