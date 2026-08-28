import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDevServer, DEV_SERVER_HOST } from "../scripts/dev-server.mjs";

async function writeFixture(root, relativePath, contents) {
  const target = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  return target;
}

async function withServer(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), "circ-hq-public-root-"));
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), "circ-hq-private-seed-"));
  const privatePlanPath = await writeFixture(privateRoot, "plan.json", "GENERIC_PRIVATE_PLAN");
  const privateOptionsPath = await writeFixture(privateRoot, "options.json", "GENERIC_PRIVATE_OPTIONS");

  await Promise.all([
    writeFixture(root, "index.html", "GENERIC_INDEX"),
    writeFixture(root, "mission-control.html", "GENERIC_MIRROR"),
    writeFixture(root, "classroom-legacy.html", "GENERIC_LEGACY"),
    writeFixture(root, "app.css", "GENERIC_CSS"),
    writeFixture(root, "src/app.js", "GENERIC_APP"),
    writeFixture(root, ".superpowers/private/generic.json", "GENERIC_IGNORED_PRIVATE"),
    writeFixture(root, ".superpowers/sdd/generic-report.md", "GENERIC_INTERNAL_REPORT"),
    writeFixture(root, ".git", "GENERIC_GIT_METADATA"),
    writeFixture(root, "tests/generic.test.mjs", "GENERIC_TEST"),
    writeFixture(root, "scripts/dev-server.mjs", "GENERIC_SERVER_SOURCE"),
    writeFixture(root, "package.json", "GENERIC_PACKAGE"),
    writeFixture(root, "src/storage/firebase-adapter.js", "GENERIC_UNUSED_FIREBASE"),
    writeFixture(root, "src/storage/sync-engine.js", "GENERIC_UNUSED_SYNC")
  ]);

  const server = createDevServer({ root, privatePlanPath, privateOptionsPath });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, DEV_SERVER_HOST, resolve);
  });
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(privateRoot, { recursive: true, force: true })
    ]);
  });
  const { port } = server.address();
  return async (pathname, options = {}) => {
    const response = await fetch(`http://${DEV_SERVER_HOST}:${port}${pathname}`, options);
    return {
      status: response.status,
      allow: response.headers.get("allow"),
      cacheControl: response.headers.get("cache-control"),
      body: await response.text()
    };
  };
}

test("the real dev server serves only the explicit public runtime allowlist", async (context) => {
  const request = await withServer(context);

  for (const [pathname, expectedBody] of [
    ["/", "GENERIC_INDEX"],
    ["/index.html", "GENERIC_INDEX"],
    ["/mission-control.html", "GENERIC_MIRROR"],
    ["/classroom-legacy.html", "GENERIC_LEGACY"],
    ["/app.css", "GENERIC_CSS"],
    ["/src/app.js", "GENERIC_APP"]
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.body, expectedBody, pathname);
  }

  for (const pathname of [
    "/.superpowers/private/generic.json",
    "/%2esuperpowers/private/generic.json",
    "/__private__/%2e%2e/.superpowers/private/generic.json",
    "/.superpowers/private/generic.json?probe=generic",
    "/.superpowers/sdd/generic-report.md",
    "/.git",
    "/%2egit",
    "/tests/generic.test.mjs",
    "/scripts/dev-server.mjs",
    "/package.json",
    "/src/storage/firebase-adapter.js",
    "/src/storage/sync-engine.js"
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
    assert.doesNotMatch(response.body, /GENERIC_(?:IGNORED_PRIVATE|INTERNAL_REPORT|GIT_METADATA|TEST|SERVER_SOURCE|PACKAGE|UNUSED_FIREBASE|UNUSED_SYNC)/, pathname);
  }
});

test("private seed routes are exact no-store GET or HEAD endpoints", async (context) => {
  const request = await withServer(context);

  for (const pathname of ["/__private__/plan.json", "/__private__/migration-options.json"]) {
    const get = await request(`${pathname}?probe=generic`);
    assert.equal(get.status, 200, pathname);
    assert.equal(get.cacheControl, "no-store", pathname);
    assert.match(get.body, /^GENERIC_PRIVATE_(?:PLAN|OPTIONS)$/);

    const head = await request(pathname, { method: "HEAD" });
    assert.equal(head.status, 200, pathname);
    assert.equal(head.cacheControl, "no-store", pathname);
    assert.equal(head.body, "", pathname);

    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const rejected = await request(pathname, { method });
      assert.equal(rejected.status, 405, `${method} ${pathname}`);
      assert.equal(rejected.allow, "GET, HEAD", `${method} ${pathname}`);
      assert.equal(rejected.cacheControl, "no-store", `${method} ${pathname}`);
      assert.equal(rejected.body, "", `${method} ${pathname}`);
    }
  }

  const unknown = await request("/__private__/unknown.json");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.cacheControl, "no-store");
  assert.equal(unknown.body, "");
});

test("public static files reject non-GET methods and HEAD never returns a body", async (context) => {
  const request = await withServer(context);

  const head = await request("/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    const rejected = await request("/index.html", { method });
    assert.equal(rejected.status, 405, method);
    assert.equal(rejected.allow, "GET, HEAD", method);
    assert.equal(rejected.body, "", method);
  }
});
