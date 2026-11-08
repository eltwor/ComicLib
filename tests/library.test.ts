import { describe, expect, it } from "vitest";
import * as L from "../src/library.ts";

it("unread is the absence of an entry", () => {
  const lib = L.emptyLibrary();
  expect(L.readAtOfIss(lib, 1)).toBeUndefined();
  expect(Object.keys(lib.issues)).toEqual([]);
});

it("Applying the status to read", () => {
    const lib = L.emptyLibrary();
    L.applyReadIss(lib,10,"2020-08-20");
    expect(lib.issues[10]).toEqual({readAt: "2020-08-20"})
});

it("Returning the date", () => {
    const lib = L.emptyLibrary();
    L.applyReadIss(lib,10,"2020-08-20");
    expect(L.readAtOfIss(lib,10)).toEqual("2020-08-20");
})

it("Making issue not read", () => {
    const lib = L.emptyLibrary();
    L.applyReadIss(lib,1,"2020-08-20");
    L.clearReadIss(lib,1);
    expect(lib.issues[1]).toBeUndefined()
})

it("Ignoring and unignoring a volume", () =>{
    const lib = L.emptyLibrary();
    L.applyIgnoredVol(lib,1,true);
    expect(lib.volumes[1]).toEqual({ignored: true})
    L.applyIgnoredVol(lib,1,false)
    expect(lib.volumes[1]).toBeUndefined()
})


it("withReadIss returns the date", () => {
    const lib = L.emptyLibrary();
    const rows = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
    L.applyReadIss(lib,1,"2020-08-20");
    const out = L.withReadIss(rows,lib);
    expect(out[0].readAt).toBe("2020-08-20");
    expect(out[1].readAt).toBeNull();
})

it("Progress of volume", () => {
    const lib = L.emptyLibrary();
    const testSumm = [{id: 1, volumeId:0},{id:2,volumeId:0},{id:3,volumeId:0}];
    L.applyReadIss(lib,1,"2020-08-20");
    const progress = L.progressByVolume(lib,testSumm);
    expect(progress.size).toBe(1);
    expect(progress.get(0)).toEqual({ pulled: 3, read: 1 });
})  

it("un-ignoring keeps the reading flag", () => {
  const lib = L.emptyLibrary();
  L.applyIgnoredVol(lib, 1, true);
  L.applyReadingVol(lib, 1, true);
  L.applyIgnoredVol(lib, 1, false);
  expect(lib.volumes[1]).toEqual({ reading: true }); // not deleted
});

it("un-reading keeps the ignored flag", () => {
  const lib = L.emptyLibrary();
  L.applyReadingVol(lib, 1, true);
  L.applyIgnoredVol(lib, 1, true);
  L.applyReadingVol(lib, 1, false);
  expect(lib.volumes[1]).toEqual({ ignored: true }); // not deleted
});

it("Check volume state", () => {
    const finishedVolume = L.volumeState(5,5,true,false)
    const caughtUpVolume = L.volumeState(5,5,true,true);
    const toReadvolume = L.volumeState(0,10,true,false);
    const untouchedVolume = L.volumeState(0,10,false,false);
    const readingVolume = L.volumeState(5,10,true,false);
    const partialVolume = L.volumeState(5,10,false,false);

    expect(finishedVolume).toBe("complete");
    expect(caughtUpVolume).toBe("caught-up");
    expect(toReadvolume).toBe("to-read");
    expect(untouchedVolume).toBe("untouched");
    expect(readingVolume).toBe("reading");
    expect(partialVolume).toBe("partial");

})

it("Bulk setting the date to be read", () => {
    const issueIds = [1,2,3,4];
    const lib = L.emptyLibrary();
    L.applyBulkRead(lib,issueIds,"2020-08-10");
    expect(lib.issues[1]).toEqual({readAt: "2020-08-10"});
    L.clearBulkRead(lib,issueIds);
    expect(lib.issues[1]).toBeUndefined()
})

it("Read Dates for History", () => {
    const testSumm = [{id: 1, volumeId:0},{id:2,volumeId:0},{id:3,volumeId:0}];
    const lib = L.emptyLibrary();
    L.applyReadIss(lib,1,"2020-08-10")
    L.applyReadIss(lib,2,"2020-08-12")
    L.applyReadIss(lib,3,"2020-08-15")
    const volData = L.readDatesByVolume(lib, testSumm)
    expect(volData.get(0)).toEqual({firstReadAt: "2020-08-10",lastReadAt: "2020-08-15"})
    expect(volData.get(1)).toBeUndefined()
})

it("toggles a volume favourite", () => {
  const lib = L.emptyLibrary();
  expect(L.isFavouriteVolume(lib, 5)).toBe(false);
  expect(L.toggleFavouriteVolume(lib, 5)).toBe(true);
  expect(L.isFavouriteVolume(lib, 5)).toBe(true);
  expect(L.toggleFavouriteVolume(lib, 5)).toBe(false);
  expect(L.isFavouriteVolume(lib, 5)).toBe(false);
});

it("toggles a creator favourite", () => {
  const lib = L.emptyLibrary();
  expect(L.toggleFavouriteCreator(lib, 1699)).toBe(true);
  expect(L.isFavouriteCreator(lib, 1699)).toBe(true);
  expect(L.toggleFavouriteCreator(lib, 1699)).toBe(false);
});

it("adds tags case-insensitively and keeps insertion order", () => {
  const lib = L.emptyLibrary();
  expect(L.applyVolumeTag(lib, 1, "Rebirth", true)).toEqual(["Rebirth"]);
  expect(L.applyVolumeTag(lib, 1, "  New 52 ", true)).toEqual([
    "Rebirth",
    "New 52",
  ]);
  expect(L.applyVolumeTag(lib, 1, "rebirth", true)).toEqual([
    "Rebirth",
    "New 52",
  ]);
  expect(L.volumeTagsOf(lib, 1)).toEqual(["Rebirth", "New 52"]);
});

it("removes the last tag and prunes the volume entry", () => {
  const lib = L.emptyLibrary();
  L.applyVolumeTag(lib, 1, "Rebirth", true);
  expect(L.applyVolumeTag(lib, 1, "rebirth", false)).toEqual([]);
  expect(lib.volumes[1]).toBeUndefined();
});

it("keeps a volume entry that has other data when tags are removed", () => {
  const lib = L.emptyLibrary();
  L.applyReadingVol(lib, 1, true);
  L.applyVolumeTag(lib, 1, "Rebirth", true);
  L.applyVolumeTag(lib, 1, "Rebirth", false);
  expect(lib.volumes[1]).toEqual({ reading: true });
});

it("stores and clears a next-release override", () => {
  const lib = L.emptyLibrary();
  L.applyNextReleaseVol(lib, 1, "2025-06-04");
  expect(L.nextReleaseOf(lib, 1)).toBe("2025-06-04");
  L.applyNextReleaseVol(lib, 1, null);
  expect(L.nextReleaseOf(lib, 1)).toBeUndefined();
  expect(lib.volumes[1]).toBeUndefined();
});

it("derives the latest issue date per volume", () => {
  const summaries = [
    { volumeId: 1, datePublished: "2025-01-08" },
    { volumeId: 1, datePublished: "2024-12-11" },
    { volumeId: 2, datePublished: "" },
    { volumeId: 3, datePublished: "2025-02-12" },
  ];

  const latest = L.latestIssueDateByVolume(summaries);
  expect(latest.get(1)).toBe("2025-01-08");
  expect(latest.get(2)).toBeUndefined();
  expect(latest.get(3)).toBe("2025-02-12");
});