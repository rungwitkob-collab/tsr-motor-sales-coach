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

/** event ที่ App ใช้รีเซ็ตหน้าฝึกโทรกลับไปหน้าเลือกลูกค้า เมื่อกดชื่อแอปขณะอยู่ที่หน้าแรกอยู่แล้ว */
export const HOME_EVENT = "tsr:home";

/** กลับหน้าแรก (หน้าฝึกโทร) และรีเซ็ตหน้านั้นให้เริ่มใหม่ ใช้กับลิงก์ชื่อแอป/ชื่อบริษัทที่หัวเว็บ */
export function goHome(): void {
  const atHome = window.location.hash === "" || window.location.hash === "#/" || window.location.hash === "#";
  if (!atHome) window.location.hash = "/";
  window.dispatchEvent(new Event(HOME_EVENT));
}
