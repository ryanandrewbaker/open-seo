import { KeywordResearchDesktopResults } from "./KeywordResearchDesktopResults";
import { KeywordResearchMobileResults } from "./KeywordResearchMobileResults";
import { KeywordVolumeScopeNotice } from "./KeywordVolumeScopeNotice";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
};

export function KeywordResearchResults({ controller }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full gap-2">
      <KeywordVolumeScopeNotice
        locationName={controller.lastSearchLocationName}
        locationCode={controller.lastSearchLocationCode}
      />
      <KeywordResearchDesktopResults controller={controller} />
      <KeywordResearchMobileResults controller={controller} />
    </div>
  );
}
