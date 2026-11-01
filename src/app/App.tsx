import { useEffect, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Layout } from "./components/Layout.tsx";
import { PasscodeGate } from "./components/PasscodeGate.tsx";
import { initProgress } from "./lib/progress.ts";
import { HOME_EVENT, useHashRoute } from "./lib/router.ts";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { DrillPage } from "./pages/DrillPage.tsx";
import { QuizPage } from "./pages/QuizPage.tsx";
import { RoleplayPage } from "./pages/RoleplayPage.tsx";
import { ScriptsPage } from "./pages/ScriptsPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";

export default function App() {
  const route = useHashRoute();

  // เปลี่ยน key เพื่อ remount หน้าฝึกโทรเมื่อผู้ใช้กด "กลับหน้าแรก" จากหัวเว็บ (รีเซ็ตผลประเมิน/สายเดิม)
  const [homeKey, setHomeKey] = useState(0);

  useEffect(() => {
    void initProgress();
  }, []);

  useEffect(() => {
    const onHome = () => setHomeKey((k) => k + 1);
    window.addEventListener(HOME_EVENT, onHome);
    return () => window.removeEventListener(HOME_EVENT, onHome);
  }, []);

  return (
    <ErrorBoundary>
      <PasscodeGate>
        <Layout active={route.path}>
          {/* หน้าโทรถูก mount ค้างไว้ เพื่อไม่ให้สายหลุดเมื่อสลับไปเปิดสคริปต์ระหว่างคุย */}
          <div hidden={route.path !== "/"}>
            <RoleplayPage key={homeKey} />
          </div>
          {route.path === "/drill" && <DrillPage key={route.params.get("focus") ?? "all"} focusParam={route.params.get("focus")} />}
          {route.path === "/scripts" && <ScriptsPage />}
          {route.path === "/quiz" && <QuizPage />}
          {route.path === "/dashboard" && <DashboardPage />}
          {route.path === "/settings" && <SettingsPage />}
        </Layout>
      </PasscodeGate>
    </ErrorBoundary>
  );
}
