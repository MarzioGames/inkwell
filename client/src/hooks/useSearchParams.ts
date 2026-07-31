import { useLocation } from "wouter";
import { useMemo } from "react";

export function useSearchParams() {
  const [location] = useLocation();
  return useMemo(() => {
    const queryStart = location.indexOf("?");
    if (queryStart === -1) return new URLSearchParams();
    return new URLSearchParams(location.slice(queryStart + 1));
  }, [location]);
}
