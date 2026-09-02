import { Info } from "lucide-react";
import {
  formatLocationLabel,
  LOCATION_OPTIONS,
} from "@/shared/keyword-locations";

type Props = {
  locationName?: string;
  locationCode: number;
};

export function KeywordVolumeScopeNotice({
  locationName,
  locationCode,
}: Props) {
  if (!locationName) return null;

  const cityLabel = formatLocationLabel(locationName, 2);
  const countryLabel =
    LOCATION_OPTIONS.find((option) => option.code === locationCode)?.label ??
    "this country";

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-base-content/80"
      role="status"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-info" />
      <span>
        Volumes are for {cityLabel} (Google Ads). Keyword ideas and difficulty
        remain {countryLabel}-wide.
      </span>
    </div>
  );
}
