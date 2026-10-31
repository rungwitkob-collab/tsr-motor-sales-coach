/** hash router ขนาดเล็ก (#/drill?focus=closing) ไม่ต้องตั้งค่า server เพิ่ม */
import { useEffect, useState } from "react";

export const ROUTES = ["/", "/drill", "/scripts", "/quiz", "/dashboard"] as const;
export type RoutePath = (typeof ROUTES)[number];

export interface Route {
  path: RoutePath;
  params: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, query = ""] = raw.split("?");
  const path = (ROUTES as readonly string[]).includes(pathPart ?? "") ? (pathPart as RoutePath) : "/";
  return { path, params: new URLSearchParams(query) };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(path: RoutePath, params?: Record<string, string>): void {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  window.location.hash = `${path}${query}`;
}
