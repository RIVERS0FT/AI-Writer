import {
  createWritingOrchestratorPlatform,
  type PlatformService,
} from "@ai-writer/platform";
import { useMemo, useState } from "react";
import { AppShell as LegacyAppShell } from "./AppShell";
import { ContentManager } from "./ContentManager";
import { KnowledgeLibrary } from "./KnowledgeLibraryWithStyles";
import { createRetryingPlatform } from "./retrying-platform";
import { WritingInsights } from "./WritingInsightsWithStyles";
import "./stage4.css";

export interface ManagedAppShellProps {
  platform: PlatformService;
}

export function ManagedAppShell({ platform }: ManagedAppShellProps) {
  const [revision, setRevision] = useState(0);
  const writingPlatform = useMemo(
    () =>
      createWritingOrchestratorPlatform(createRetryingPlatform(platform)),
    [platform],
  );

  return (
    <>
      <div key={revision}>
        <LegacyAppShell platform={writingPlatform} />
      </div>
      <ContentManager
        platform={writingPlatform}
        onChanged={() => setRevision((current) => current + 1)}
      />
      <KnowledgeLibrary platform={writingPlatform} />
      <WritingInsights platform={writingPlatform} />
    </>
  );
}
