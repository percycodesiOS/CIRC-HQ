import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getPublicStaticManifest } from "../scripts/dev-server.mjs";

const page = await readFile(new URL("../network-lab.html", import.meta.url), "utf8");
test("networking lesson has no account, student storage or submission surface", () => {
  assert.doesNotMatch(page, /<script\b|<iframe\b|<form\b|<input\b|<textarea\b|firebase|localStorage|src\/app\.js/i);
  for (const target of page.matchAll(/href="#([^"]+)"/g)) assert.ok(page.includes(`id="${target[1]}"`));
  for (const path of ["network-lab.html", "network-lab.css", "assets/guides/CIRC-Network-Lab.pdf"]) assert.ok(getPublicStaticManifest().includes(path));
});
test("networking lab teaches correct T568B, standalone testing, and the limits of continuity", () => {
  assert.match(page, /pins 1 through 8: white orange, orange, white green, blue, white blue, green, white brown, brown/);
  assert.match(page, /T568B at both ends/);
  assert.match(page, /clip is underneath/);
  assert.match(page, /1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7, 8→8/);
  assert.match(page, /never plug it into a wall jack, school device, switch, router or PoE equipment/i);
  assert.match(page, /miss split pairs/);
  assert.match(page, /used crimp plugs cannot/);
  assert.equal((page.match(/<th scope="row">[1-7]<\/th>/g) ?? []).length, 7);
});
