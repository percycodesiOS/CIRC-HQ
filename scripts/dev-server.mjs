import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEV_SERVER_HOST = "127.0.0.1";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"]
]);

const PUBLIC_STATIC_FILES = new Set([
  "index.html",
  "mission-control.html",
  "app.css",
  "assets/designers-challenge-sketch.webp",
  "assets/tech-terrarium-hero.webp",
  "assets/icons/arrow-right.svg",
  "assets/icons/books.svg",
  "assets/icons/calendar-dots.svg",
  "assets/icons/chalkboard-teacher.svg",
  "assets/icons/cloud-lightning.svg",
  "assets/icons/cloud-rain.svg",
  "assets/icons/cloud-sun.svg",
  "assets/icons/cloud.svg",
  "assets/icons/download-simple.svg",
  "assets/icons/gear-six.svg",
  "assets/icons/house.svg",
  "assets/icons/play-circle.svg",
  "assets/icons/presentation-chart.svg",
  "assets/icons/snowflake.svg",
  "assets/icons/student.svg",
  "assets/icons/sun.svg",
  "assets/icons/warning-circle.svg",
  "src/app.js",
  "src/model/access.js",
  "src/model/admin-plan.js",
  "src/model/experience-runner.js",
  "src/model/experience-timing-plans.js",
  "src/model/lesson-guide.js",
  "src/model/project-catalog.js",
  "src/model/schedule.js",
  "src/model/state.js",
  "src/model/step-timer.js",
  "src/model/teacher-plan-v1.js",
  "src/model/teacher-plan.js",
  "src/services/weather.js",
  "src/storage/local-store.js",
  "src/ui/board.js",
  "src/ui/project-home.js",
  "src/ui/room.js",
  "src/ui/settings.js",
  "src/ui/today-ui.js",
  "src/ui/view-model.js"
]);

export function getPublicStaticManifest() {
  return [...PUBLIC_STATIC_FILES].sort();
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function notFound() {
  return { status: 404, headers: noStoreHeaders(), body: "" };
}

function methodNotAllowed(headers = {}) {
  return {
    status: 405,
    headers: {
      ...headers,
      "Cache-Control": "no-store",
      Allow: "GET, HEAD"
    },
    body: ""
  };
}

function ordinaryRequestUrl(rawTarget) {
  if (
    typeof rawTarget !== "string" ||
    !rawTarget.startsWith("/") ||
    rawTarget.startsWith("//") ||
    /[\u0000-\u0020\u007f\\#]/.test(rawTarget) ||
    /%(?![0-9a-f]{2})/i.test(rawTarget) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|20|23|25|2e|2f|3a|3f|5c|7f)/i.test(rawTarget)
  ) return null;

  const queryStart = rawTarget.indexOf("?");
  const rawPathname = queryStart === -1 ? rawTarget : rawTarget.slice(0, queryStart);
  if (
    rawPathname.includes("%") ||
    rawPathname.split("/").some((segment) => segment === "." || segment === "..")
  ) return null;

  try {
    const parsed = new URL(rawTarget, `http://${DEV_SERVER_HOST}`);
    if (
      parsed.origin !== `http://${DEV_SERVER_HOST}` ||
      `${parsed.pathname}${parsed.search}` !== rawTarget
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

function unsafePathname(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return decoded.includes("\\") || decoded.split("/").includes("..");
}

export function createPrivateSeedRoute(
  pathFromEnvironment,
  exactRoute = "/__private__/plan.json"
) {
  const configuredPath = typeof pathFromEnvironment === "string" && pathFromEnvironment.trim()
    ? path.resolve(pathFromEnvironment)
    : null;
  return async (pathname) => {
    if (!configuredPath || pathname !== exactRoute || unsafePathname(pathname)) return notFound();
    try {
      return {
        status: 200,
        headers: noStoreHeaders(),
        body: await readFile(configuredPath, "utf8")
      };
    } catch {
      return notFound();
    }
  };
}

function publicStaticPath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment === ".." || segment.startsWith("."))) return null;
  const requested = decoded === "/" ? "index.html" : segments.join("/");
  if (!PUBLIC_STATIC_FILES.has(requested)) return null;
  return path.join(root, ...requested.split("/"));
}

export function createDevServer({
  root = path.resolve(fileURLToPath(new URL("..", import.meta.url))),
  privatePlanPath = process.env.PLAYBOOK_PRIVATE_PLAN,
  privateOptionsPath = process.env.PLAYBOOK_PRIVATE_OPTIONS
} = {}) {
  const planRoute = createPrivateSeedRoute(privatePlanPath, "/__private__/plan.json");
  const optionsRoute = createPrivateSeedRoute(
    privateOptionsPath,
    "/__private__/migration-options.json"
  );
  return createServer(async (request, response) => {
    const url = ordinaryRequestUrl(request.url);
    if (!url) {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end();
      return;
    }
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      const privateRequest = url.pathname.startsWith("/__private__/");
      const result = methodNotAllowed(privateRequest ? noStoreHeaders() : {});
      response.writeHead(result.status, result.headers);
      response.end();
      return;
    }
    if (url.pathname.startsWith("/__private__/")) {
      const route = url.pathname === "/__private__/plan.json" ? planRoute : optionsRoute;
      const result = await route(url.pathname);
      response.writeHead(result.status, result.headers);
      response.end(method === "HEAD" ? undefined : result.body);
      return;
    }
    const file = publicStaticPath(path.resolve(root), url.pathname);
    if (!file) {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(method === "HEAD" ? undefined : "Not found");
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      if (method === "HEAD") response.end();
      else createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(method === "HEAD" ? undefined : "Not found");
    }
  });
}

export function startDevServer(options = {}) {
  const server = createDevServer(options);
  const port = Number(process.env.PORT) || 4173;
  server.listen(port, DEV_SERVER_HOST, () => {
    process.stdout.write(`CIRC HQ local server: http://${DEV_SERVER_HOST}:${port}\n`);
  });
  return server;
}

const executedDirectly = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (executedDirectly) startDevServer();
