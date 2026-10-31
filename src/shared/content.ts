/**
 * เนื้อหาที่ "ไม่เป็นความลับ" ใช้ได้ทั้งหน้าเว็บและ Worker
 * (personas.json ไม่อยู่ที่นี่ เพราะมีข้อมูลซ่อนที่ไม่ควรถูก bundle ไปหน้าเว็บ)
 */
import companyJson from "../../data/company.json";
import productsJson from "../../data/products.json";
import objectionsJson from "../../data/objections.json";
import scriptsJson from "../../data/scripts.json";
import type { Company, ObjectionsData, ProductsData, ScriptsData } from "./types.ts";

export const company: Company = companyJson;
export const products = productsJson as ProductsData;
export const objectionsData: ObjectionsData = objectionsJson;
export const scriptsData: ScriptsData = scriptsJson;

export function findPlan(planId: string) {
  return products.plans.find((p) => p.id === planId);
}

export function findObjection(objectionId: string) {
  return objectionsData.objections.find((o) => o.id === objectionId);
}

export function objectionGroupLabel(groupId: string): string {
  return objectionsData.groups.find((g) => g.id === groupId)?.label ?? groupId;
}
