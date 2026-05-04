import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("happy-dom provides a document", () => {
    expect(typeof document).toBe("object");
    document.body.innerHTML = "<p>hi</p>";
    expect(document.body.querySelector("p")?.textContent).toBe("hi");
  });
});
