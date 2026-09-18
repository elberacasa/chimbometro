import { describe, expect, it } from "vitest";
import { htmlToText } from "./sources";

describe("htmlToText", () => {
  it("turns HN comment HTML into readable lines with decoded entities", () => {
    const html =
      'Railway | Senior Engineer | REMOTE (Worldwide)<p>We&#x27;re hiring &amp; growing.<p>Apply: <a href="x">link</a>';
    expect(htmlToText(html)).toBe(
      "Railway | Senior Engineer | REMOTE (Worldwide)\nWe're hiring & growing.\nApply: link",
    );
  });

  it("strips CDATA wrappers from RSS", () => {
    expect(htmlToText("<![CDATA[<strong>Headquarters:</strong> Remote]]>")).toBe(
      "Headquarters: Remote",
    );
  });
});

describe("structured fields", () => {
  it("reads Jobicy regions: anything covering Venezuela counts", async () => {
    const { jobicyWhere, jobicyLevels } = await import("./sources");
    expect(jobicyWhere("LATAM,  Canada,  USA")).toBe("anywhere");
    expect(jobicyWhere("Anywhere")).toBe("anywhere");
    expect(jobicyWhere("Brazil,  Mexico")).toBe("country_only");
    expect(jobicyLevels("Entry-Level, Junior")).toEqual(["junior"]);
    expect(jobicyLevels("Any")).toBeNull();
  });

  it("reads Himalayas restrictions: worldwide or a list with Venezuela", async () => {
    const { himalayasWhere } = await import("./sources");
    expect(himalayasWhere([])).toBe("anywhere");
    expect(himalayasWhere(["Argentina", "Venezuela"])).toBe("anywhere");
    expect(himalayasWhere(["United States"])).toBe("country_only");
  });

  it("converts yearly USD salaries to monthly and ignores other currencies", async () => {
    const { monthlyUsd } = await import("./sources");
    expect(monthlyUsd(60000, 120000, "USD", "year")).toEqual({ min: 5000, max: 10000 });
    expect(monthlyUsd(60000, 120000, "EUR", "year")).toBeNull();
  });
});
