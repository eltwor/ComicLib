import { expect, it } from "vitest";
import { buildCreatorIndex } from "../src/search.ts"

it("Building the index", () => {
const details = [
  { id: 1, detail: { person_credits: [{ id: 7, name: "Tom King", role: "writer" }] } },
];    const validIds = new Set([1,2])
    const index = buildCreatorIndex(details,validIds)
expect(index.get(7)?.roles).toEqual(new Set(["writer"]));
expect(index.get(7)?.issues.get(1)).toEqual(new Set(["writer"]));
})