import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getPublicStaticManifest } from "../scripts/dev-server.mjs";

const page = await readFile(new URL("../fid.html", import.meta.url), "utf8");
const css = await readFile(new URL("../fid.css", import.meta.url), "utf8");

test("FID directions are complete without loading the teacher app or collecting student work", () => {
  assert.doesNotMatch(page, /<script\b|<iframe\b|<form\b|<input\b|<textarea\b|firebase|localStorage|src\/app\.js|https?:\/\//i);
  assert.equal((page.match(/<article id="fid-/g) ?? []).length, 4);
  const activities = [...page.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);
  for (const activity of activities) {
    const steps = activity.match(/<ol class="fid-steps">([\s\S]*?)<\/ol>/)?.[1] ?? "";
    assert.equal((steps.match(/<li>/g) ?? []).length, 3);
    assert.match(activity, /Finish check/);
    assert.match(activity, /Think or say:/);
    assert.match(activity, /Want another challenge/);
  }
});

test("every FID choice reaches a real challenge and its local assets are in the public allowlist", () => {
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const match of page.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(match[1]), match[1]);
  const manifest = new Set(getPublicStaticManifest());
  for (const path of ["fid.html", "fid.css", "assets/icons/sv-interlock.png"]) assert.ok(manifest.has(path), path);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /Arial|url\(/i);
});
