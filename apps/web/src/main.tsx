import { createWebPlatform } from "@ai-writer/platform/web";
import { AppShell } from "@ai-writer/ui";
import "@ai-writer/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const element = document.getElementById("root");
if (!element) throw new Error("Root element not found");

createRoot(element).render(
  <StrictMode>
    <AppShell platform={createWebPlatform()} />
  </StrictMode>,
);
