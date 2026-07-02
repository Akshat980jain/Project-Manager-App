import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("ph-theme") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    apply(theme);
    localStorage.setItem("ph-theme", theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}

// Apply on first import in browser to avoid flash
if (typeof window !== "undefined") {
  apply(getInitial());
}
