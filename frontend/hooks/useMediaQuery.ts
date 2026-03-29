import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", listener);
    
    return () => mediaQueryList.removeEventListener("change", listener);
  }, [query]);

  // Return false during SSR and initial hydration to avoid mismatch
  if (!mounted) return false;

  return matches;
}
