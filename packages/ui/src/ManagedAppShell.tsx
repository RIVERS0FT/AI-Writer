import type { PlatformService } from "@ai-writer/platform";
import { useMemo, useState } from "react";
import { AppShell as LegacyAppShell } from "./AppShell";
import { ContentManager } from "./ContentManager";
import { KnowledgeLibrary } from "./KnowledgeLibrary";
import { createRetryingPlatform } from "./retrying-platform";
import "./stage4.css";

export interface ManagedAppShellProps {
  platform: PlatformService;
}

export function ManagedAppShell({ platform }: ManagedAppShellProps) {
  const [revision, setRevision] = useState(0);
  const retryingPlatform = useMemo(
    () => createRetryingPlatform(platform),
    [platform],
  );

  return (
    <>
      <div key={revision}>
        <LegacyAppShell platform={retryingPlatform} />
      </div>
      <ContentManager
        platform={retryingPlatform}
        onChanged={() => setRevision((current) => current + 1)}
      />
      <KnowledgeLibrary platform={retryingPlatform} />
    </>
  );
}
