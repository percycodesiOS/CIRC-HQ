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
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function notFound() {
  return { status: 404, headers: noStoreHeaders(), body: "" };
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

function resolveStaticPath(root, pathname) {
  if (unsafePathname(pathname)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requested = decoded === "/" ? "/index.html" : decoded;
  const candidate = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, candidate);
  return relative.startsWith("..") || path.isAbsolute(relative) ? null : candidate;
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
    const url = new URL(request.url ?? "/", `http://${DEV_SERVER_HOST}`);
    if (url.pathname.startsWith("/__private__/")) {
      const route = url.pathname === "/__private__/plan.json" ? planRoute : optionsRoute;
      const result = await route(url.pathname);
      response.writeHead(result.status, result.headers);
      response.end(result.body);
      return;
    }
    const file = resolveStaticPath(path.resolve(root), url.pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
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
