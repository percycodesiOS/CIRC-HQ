import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as devServer from "../scripts/dev-server.mjs";

const { createDevServer, DEV_SERVER_HOST } = devServer;

test("uses the dedicated CIRC HQ development port", () => {
  assert.equal(devServer.DEFAULT_PORT, 4273);
});

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
    writeFixture(root, "src/model/admin-plan.js", "GENERIC_ADMIN_PLAN"),
    writeFixture(root, "src/model/experience-runner.js", "GENERIC_EXPERIENCE_RUNNER"),
    writeFixture(root, "src/model/experience-timing-plans.js", "GENERIC_EXPERIENCE_TIMING"),
    writeFixture(root, "src/model/project-catalog.js", "GENERIC_PROJECT_CATALOG"),
    writeFixture(root, "src/model/step-timer.js", "GENERIC_STEP_TIMER"),
    writeFixture(root, "src/ui/project-home.js", "GENERIC_PROJECT_HOME"),
    writeFixture(root, "assets/circ-hq-maker.webp", "GENERIC_MAKER_IMAGE"),
    writeFixture(root, "assets/tech-terrarium-hero.webp", "GENERIC_HERO_IMAGE"),
    writeFixture(root, "assets/icons/house.svg", "GENERIC_HOUSE_ICON"),
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
  const request = async (pathname, options = {}) => {
    const response = await fetch(`http://${DEV_SERVER_HOST}:${port}${pathname}`, options);
    return {
      status: response.status,
      allow: response.headers.get("allow"),
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
      body: await response.text()
    };
  };
  request.raw = (target, method = "GET") => new Promise((resolve) => {
    const socket = createConnection({ host: DEV_SERVER_HOST, port });
    const chunks = [];
    const finish = () => {
      const response = Buffer.concat(chunks);
      const headerEnd = response.indexOf("\r\n\r\n");
      const headerBytes = headerEnd === -1 ? response : response.subarray(0, headerEnd);
      const body = headerEnd === -1 ? Buffer.alloc(0) : response.subarray(headerEnd + 4);
      const status = Number(/^HTTP\/1\.1 (\d{3})/m.exec(headerBytes.toString("latin1"))?.[1] ?? 0);
      resolve({ status, body });
    };
    socket.setTimeout(2_000, socket.destroy);
    socket.once("connect", () => {
      socket.write(`${method} ${target} HTTP/1.1\r\nHost: ${DEV_SERVER_HOST}:${port}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.once("end", finish);
    socket.once("close", () => {
      if (!socket.readableEnded) finish();
    });
    socket.once("error", finish);
  });
  return request;
}

test("the real dev server serves only the explicit public runtime allowlist", async (context) => {
  const request = await withServer(context);

  for (const [pathname, expectedBody] of [
    ["/", "GENERIC_INDEX"],
    ["/index.html", "GENERIC_INDEX"],
    ["/mission-control.html", "GENERIC_MIRROR"],
    ["/app.css", "GENERIC_CSS"],
    ["/src/app.js", "GENERIC_APP"],
    ["/src/model/admin-plan.js", "GENERIC_ADMIN_PLAN"],
    ["/src/model/experience-runner.js", "GENERIC_EXPERIENCE_RUNNER"],
    ["/src/model/experience-timing-plans.js", "GENERIC_EXPERIENCE_TIMING"],
    ["/src/model/project-catalog.js", "GENERIC_PROJECT_CATALOG"],
    ["/src/model/step-timer.js", "GENERIC_STEP_TIMER"],
    ["/src/ui/project-home.js", "GENERIC_PROJECT_HOME"],
    ["/assets/circ-hq-maker.webp", "GENERIC_MAKER_IMAGE"],
    ["/assets/tech-terrarium-hero.webp", "GENERIC_HERO_IMAGE"],
    ["/assets/icons/house.svg", "GENERIC_HOUSE_ICON"]
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.body, expectedBody, pathname);
  }

  assert.equal((await request("/assets/circ-hq-maker.webp")).contentType, "image/webp");
  assert.equal((await request("/assets/tech-terrarium-hero.webp")).contentType, "image/webp");
  assert.equal((await request("/assets/icons/house.svg")).contentType, "image/svg+xml; charset=utf-8");

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
    "/classroom-legacy.html",
    "/src/storage/firebase-adapter.js",
    "/src/storage/sync-engine.js"
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
    assert.doesNotMatch(response.body, /GENERIC_(?:IGNORED_PRIVATE|INTERNAL_REPORT|GIT_METADATA|TEST|SERVER_SOURCE|PACKAGE|LEGACY|UNUSED_FIREBASE|UNUSED_SYNC)/, pathname);
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

test("the real dev server rejects ambiguous raw request targets before URL parsing", async (context) => {
  const request = await withServer(context);
  const privateBodies = [Buffer.from("GENERIC_PRIVATE_PLAN"), Buffer.from("GENERIC_PRIVATE_OPTIONS")];
  const ambiguousTargets = [
    "/__private__/%2e/plan.json",
    "/%2e/__private__/plan.json",
    "/%2e%2e/__private__/plan.json",
    "/public/%2e%2e/__private__/plan.json",
    "//host.invalid/__private__/plan.json",
    "/.hidden/%2e%2e/index.html",
    "/__private__/%2e%2e/index.html",
    "http://host.invalid/__private__/plan.json",
    "host.invalid:443",
    "/index.html#fragment",
    "/index.html\\generic",
    "/index.html%",
    "/index.html%2",
    "/index.html%zz",
    "/__private__/%2fplan.json",
    "/__private__/%5cplan.json",
    "/__private__/%3aplan.json",
    "/__private__/%25%32%65/plan.json",
    "/__private__/%252e/plan.json",
    "/%2e%2e%2f__private__%2fplan.json",
    "/./index.html",
    "/public/../index.html",
    "/index.html%00",
    "/index.html%0d",
    "/index.html%0a"
  ];

  for (const target of ambiguousTargets) {
    for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]) {
      const response = await request.raw(target, method);
      assert.notEqual(response.status, 200, `${method} ${target}`);
      for (const privateBody of privateBodies) {
        assert.notEqual(response.body.length, privateBody.length, `${method} ${target}`);
        assert.equal(response.body.includes(privateBody), false, `${method} ${target}`);
      }
    }
  }

  const listenerStillAvailable = await request("/index.html");
  assert.equal(listenerStillAvailable.status, 200);
  assert.equal(listenerStillAvailable.body, "GENERIC_INDEX");
});
