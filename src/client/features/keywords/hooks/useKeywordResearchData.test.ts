import { describe, expect, it, vi } from "vitest";

// The hook module pulls in the server functions it calls, whose graph reaches
// Workers-only bindings that don't resolve outside workerd.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  buildKeywordResearchQueryKey,
  buildKeywordResearchRequest,
} from "./useKeywordResearchData";
import { buildKeywordSearchKey } from "@/client/features/keywords/state/keywordControllerActions";

const baseInput = {
  projectId: "project_1",
  keywordInput: "technical seo",
  locationCode: 2704,
  resultLimit: 150 as const,
  mode: "auto" as const,
  clickstream: false,
};

const australiaInput = {
  projectId: "project_1",
  keywordInput: "newborn photographer",
  locationCode: 2036,
  resultLimit: 150 as const,
  mode: "auto" as const,
  clickstream: false,
};

describe("buildKeywordResearchRequest", () => {
  it("carries an explicitly selected location without a language", () => {
    const request = buildKeywordResearchRequest(baseInput);

    expect(request).toMatchObject({ locationCode: 2704 });
    expect(request).not.toHaveProperty("languageCode");
  });

  it("leaves the location undefined for the server to resolve", () => {
    const request = buildKeywordResearchRequest({
      ...baseInput,
      locationCode: undefined,
    });

    expect(request).toMatchObject({ locationCode: undefined });
    expect(request).not.toHaveProperty("languageCode");
  });

  it("carries an optional canonical local target", () => {
    const request = buildKeywordResearchRequest({
      ...australiaInput,
      locationName: "Ararat,Victoria,Australia",
    });

    expect(request).toMatchObject({
      locationCode: 2036,
      locationName: "Ararat,Victoria,Australia",
    });
  });
});

describe("keyword research cache keys", () => {
  it("uses country targeting when locationName is omitted", () => {
    const request = buildKeywordResearchRequest(australiaInput);
    expect(buildKeywordResearchQueryKey(request)).toEqual([
      "keywordResearch",
      "project_1",
      ["newborn photographer"],
      2036,
      null,
      150,
      "auto",
      false,
    ]);
  });

  it("gives Ararat and Melbourne different React Query keys", () => {
    const ararat = buildKeywordResearchQueryKey(
      buildKeywordResearchRequest({
        ...australiaInput,
        locationName: "Ararat,Victoria,Australia",
      }),
    );
    const melbourne = buildKeywordResearchQueryKey(
      buildKeywordResearchRequest({
        ...australiaInput,
        locationName: "Melbourne,Victoria,Australia",
      }),
    );
    const national = buildKeywordResearchQueryKey(
      buildKeywordResearchRequest(australiaInput),
    );

    expect(ararat).not.toEqual(melbourne);
    expect(ararat).not.toEqual(national);
    expect(melbourne).not.toEqual(national);
  });

  it("returns to the national key when the local target is cleared", () => {
    const withCity = buildKeywordResearchQueryKey(
      buildKeywordResearchRequest({
        ...australiaInput,
        locationName: "Ararat,Victoria,Australia",
      }),
    );
    const cleared = buildKeywordResearchQueryKey(
      buildKeywordResearchRequest({
        ...australiaInput,
        locationName: undefined,
      }),
    );

    expect(cleared).toEqual(
      buildKeywordResearchQueryKey(buildKeywordResearchRequest(australiaInput)),
    );
    expect(cleared).not.toEqual(withCity);
    expect(cleared[4]).toBe(null);
  });

  it("includes the local target in the URL-driven search key", () => {
    const ararat = buildKeywordSearchKey({
      keyword: "newborn photographer",
      locationCode: 2036,
      locationName: "Ararat,Victoria,Australia",
      resultLimit: 150,
      mode: "auto",
      clickstream: false,
    });
    const melbourne = buildKeywordSearchKey({
      keyword: "newborn photographer",
      locationCode: 2036,
      locationName: "Melbourne,Victoria,Australia",
      resultLimit: 150,
      mode: "auto",
      clickstream: false,
    });
    const national = buildKeywordSearchKey({
      keyword: "newborn photographer",
      locationCode: 2036,
      resultLimit: 150,
      mode: "auto",
      clickstream: false,
    });

    expect(ararat).not.toEqual(melbourne);
    expect(ararat).not.toEqual(national);
  });
});
