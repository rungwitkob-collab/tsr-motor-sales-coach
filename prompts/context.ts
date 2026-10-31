/**
 * บริบทบริษัทและสินค้าที่แนบไปกับทุก prompt
 * ข้อมูลอ่านจาก data/company.json และ data/products.json (แก้ที่ไฟล์ JSON ไม่ต้องแก้ที่นี่)
 */
import { company, products } from "../src/shared/content.ts";

export function companyContext(): string {
  return [
    `ชื่อบริษัท: ${company.name}`,
    `${company.licenseLabel}: ${company.licenseNumber}`,
    `สายด่วนบริษัท: ${company.hotline}`,
    `ช่องทางชำระเงิน: ${company.paymentChannels.join(" / ")}`,
    `นโยบายการยกเลิก: ${company.cancellationPolicy}`,
    `ช่องทางตรวจสอบใบอนุญาต: ${company.verificationChannel}`,
  ].join("\n");
}

export function productsContext(): string {
  const plans = products.plans
    .map((p) =>
      [
        `- [${p.id}] ${p.name}: ${p.tagline}`,
        `  ความคุ้มครอง: ${p.coverage.join("; ")}`,
        `  ทุนประกัน: ${p.sumInsuredNote}`,
        `  ค่าเสียหายส่วนแรก/ข้อจำกัด: ${p.deductibleNote}`,
        `  การซ่อม: ${p.repairOptions.length ? p.repairOptions.join(", ") : "-"}`,
        `  ช่วงราคา: ${p.priceRange}`,
        `  เหมาะกับ: ${p.bestFor.join(", ")}`,
      ].join("\n"),
    )
    .join("\n");
  const knowledge = products.knowledge.map((k) => `- ${k}`).join("\n");
  return `แผนประกันที่บริษัทขาย:\n${plans}\n\nความรู้พื้นฐาน:\n${knowledge}`;
}

/** กติกาด้านภาษาที่ใช้กับทุกโมดูล */
export const THAI_OUTPUT_RULE =
  "ตอบเป็นภาษาไทยที่เป็นธรรมชาติ สุภาพ เข้าใจง่าย ห้ามแต่งเลขที่ประกาศ มาตรา หรือตัวเลขทางกฎหมายที่ไม่มีในข้อมูลที่ให้มา";
