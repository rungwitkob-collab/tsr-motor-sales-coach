/** personas อยู่เฉพาะฝั่ง Worker เพื่อไม่ให้ข้อมูลซ่อนถูก bundle ไปหน้าเว็บ */
import personasJson from "../../../data/personas.json";
import type { Persona, PersonaPublic } from "../../shared/types.ts";

export const personas = personasJson.personas as Persona[];

export function findPersona(id: string): Persona | undefined {
  return personas.find((p) => p.id === id);
}

export function toPublicPersona(p: Persona): PersonaPublic {
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    gender: p.gender,
    age: p.age,
    occupation: p.occupation,
    summary: p.summary,
    greeting: p.greeting,
  };
}
