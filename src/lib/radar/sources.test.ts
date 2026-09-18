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
