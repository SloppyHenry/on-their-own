import { describe, expect, it } from "vitest";
import { checkSeq } from "./gap";

describe("checkSeq", () => {
  it("erste Nummer ist immer gültig", () => expect(checkSeq(null, 5)).toBe("ok"));
  it("direkter Nachfolger ist gültig", () => expect(checkSeq(5, 6)).toBe("ok"));
  it("alte oder gleiche Nummer ist doppelt", () => {
    expect(checkSeq(5, 5)).toBe("duplicate");
    expect(checkSeq(5, 3)).toBe("duplicate");
  });
  it("übersprungene Nummer ist eine Lücke", () => expect(checkSeq(5, 8)).toBe("gap"));
});
