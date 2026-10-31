/** ชนิดข้อมูลของเนื้อหาในโฟลเดอร์ data/ ใช้ร่วมกันระหว่าง Worker และหน้าเว็บ */

export interface Company {
  name: string;
  licenseLabel: string;
  licenseNumber: string;
  hotline: string;
  agentRoleTitle: string;
  paymentChannels: string[];
  cancellationPolicy: string;
  verificationChannel: string;
  callRecordingNotice: string;
}

export interface ProductPlan {
  id: string;
  name: string;
  type: "voluntary" | "compulsory";
  tagline: string;
  coverage: string[];
  sumInsuredNote: string;
  deductibleNote: string;
  repairOptions: string[];
  priceRange: string;
  bestFor: string[];
  sellingPoints: string[];
}

export interface ProductsData {
  plans: ProductPlan[];
  knowledge: string[];
}

export type Gender = "male" | "female";

export interface HiddenProfile {
  car: string;
  carYear: number;
  currentInsurance: string;
  budget: string;
  usage: string;
  painPoints: string[];
  decisionFactors: string[];
  willBuyIf: string;
  hangUpIf: string;
}

/** ข้อมูล persona ที่หน้าเว็บเห็นได้ก่อนเริ่มสาย */
export interface PersonaPublic {
  id: string;
  name: string;
  title: string;
  gender: Gender;
  age: number;
  occupation: string;
  summary: string;
  greeting: string;
}

/** ข้อมูล persona เต็ม (มีเฉพาะฝั่ง Worker) */
export interface Persona extends PersonaPublic {
  personality: string;
  speakingStyle: string;
  hiddenProfile: HiddenProfile;
}

export interface ObjectionGroup {
  id: string;
  label: string;
}

export interface Objection {
  id: string;
  group: string;
  text: string;
  hint: string;
}

export interface ObjectionsData {
  groups: ObjectionGroup[];
  objections: Objection[];
}

export interface ScriptVariant {
  label: string;
  text: string;
}

export interface ScriptSection {
  id: string;
  title: string;
  goal: string;
  scripts: ScriptVariant[];
}

export interface ScriptsData {
  sections: ScriptSection[];
}

export type Difficulty = "easy" | "normal" | "hard";

export type ChatRole = "customer" | "tsr";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}
