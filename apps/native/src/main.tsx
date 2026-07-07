import { AppShell } from "@ai-writer/ui";
import "@ai-writer/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createNativePlatform } from "./platform";

const element = document.getElementById("root");
if (!element) throw new Error("Root element not found");

const root = createRoot(element);

createNativePlatform()
  .then((platform) => {
    root.render(
      <StrictMode>
        <AppShell platform={platform} />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <main style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h1>AI-Writer 启动失败</h1>
        <pre>{message}</pre>
      </main>,
    );
  });
