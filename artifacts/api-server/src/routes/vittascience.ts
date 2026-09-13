import { Router, type IRouter, type Request, type Response } from "express";
import { extname } from "node:path";

const router: IRouter = Router();

const VITTASCIENCE_RAW_ORIGIN =
  "https://raw.githubusercontent.com/vittascience/interfaces/master";
const VITTASCIENCE_PROXY_PREFIX = "/api/vittascience/repo-v6";
const ALLOWED_INTERFACES = new Set([
  "alphai",
  "arduino",
  "esp32",
  "microbit",
  "thymio",
  "python",
  "web",
]);
const ALLOWED_ASSET_ROOTS = new Set(["public", "openInterface", "interfaces"]);
const ASSET_CACHE_TTL_MS = 60 * 60 * 1000;
const HTML_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1_500;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;

const VITTASCIENCE_MODULE_CATALOG = [
  {
    slug: "thymio",
    label: "Thymio",
    interfacePath: "thymio",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Simulateur Thymio",
    },
  },
  {
    slug: "arduino",
    label: "Arduino",
    interfacePath: "arduino",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Simulateur Arduino",
    },
  },
  {
    slug: "esp32",
    label: "ESP32",
    interfacePath: "esp32",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Simulateur ESP32",
    },
  },
  {
    slug: "python",
    label: "Python",
    interfacePath: "python",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Exécution Python",
    },
  },
  {
    slug: "html-css",
    label: "Web HTML/CSS",
    interfacePath: "web",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Aperçu HTML/CSS",
    },
  },
  {
    slug: "ia",
    label: "Intelligence artificielle",
    interfacePath: "alphai",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Simulateur AlphAI",
    },
  },
  {
    slug: "micro-bit",
    label: "micro:bit",
    interfacePath: "microbit",
    capabilities: {
      blocks: true,
      code: true,
      simulator: true,
      simulatorLabel: "Simulateur micro:bit",
    },
  },
] as const;

interface CachedResource {
  status: number;
  body: Buffer;
  contentType: string | null;
  headers: Record<string, string>;
  expiresAt: number;
}

const resourceCache = new Map<string, CachedResource>();
const pendingResources = new Map<string, Promise<CachedResource>>();
let cachedBytes = 0;

function getUpstreamUrl(req: Request): { url: URL; isHtml: boolean } | null {
  const requestPath = req.path.replace(/\/{2,}/g, "/");
  const path = requestPath.replace(
    /^\/repo-v\d+(?=\/|$)/,
    "",
  ) || "/";
  const firstSegment = path.split("/")[1];

  if (
    !firstSegment ||
    (!ALLOWED_INTERFACES.has(firstSegment) &&
      !ALLOWED_ASSET_ROOTS.has(firstSegment))
  ) {
    return null;
  }

  const isInterface = ALLOWED_INTERFACES.has(firstSegment);
  const pathAfterInterface = path.slice(`/${firstSegment}`.length);
  const upstreamPath = isInterface &&
    (pathAfterInterface === "" || pathAfterInterface === "/")
    ? `/${firstSegment}/index.html`
    : path;
  const upstreamUrl = new URL(`${VITTASCIENCE_RAW_ORIGIN}${upstreamPath}`);
  const requestUrl = new URL(req.originalUrl, "http://master-class.local");
  upstreamUrl.search = requestUrl.search;
  return {
    url: upstreamUrl,
    isHtml: isInterface && upstreamPath.endsWith(".html"),
  };
}

function rewriteStandalonePaths(body: string, upstreamPath: string): string {
  const relativeInterfacesPath = extname(upstreamPath).toLowerCase() === ".css"
    ? `${VITTASCIENCE_PROXY_PREFIX}/openInterface/interfaces/`
    : `${VITTASCIENCE_PROXY_PREFIX}/interfaces/`;

  return body
    .replace(
      /(["'`])\.\.\/\.\.\/\.\.\/interfaces\//g,
      `$1${relativeInterfacesPath}`,
    )
    .replace(
      /(["'`(])\/(public|openInterface|interfaces)\//g,
      `$1${VITTASCIENCE_PROXY_PREFIX}/$2/`,
    )
    .replace(
      /(["'`])\/(public|openInterface|interfaces)(?=["'`])/g,
      `$1${VITTASCIENCE_PROXY_PREFIX}/$2`,
    )
    .replaceAll(
      `_PATH + '${VITTASCIENCE_PROXY_PREFIX}/`,
      `_PATH + '/`,
    )
    .replaceAll(
      `_PATH + "${VITTASCIENCE_PROXY_PREFIX}/`,
      `_PATH + "/`,
    )
    .replace(
      "currentScript.src = `${CDN_PATH}${filePath}`;",
      "currentScript.src = filePath.startsWith(CDN_PATH) ? filePath : `${CDN_PATH}${filePath}`;",
    );
}

function rewriteStandaloneHtml(body: string, interfaceName: string): string {
  return body
    .replace(
      "const CDN_PATH = ''",
      `const CDN_PATH = '${VITTASCIENCE_PROXY_PREFIX}'`,
    )
    .replace(
      /window\.location\.pathname\.split\(["']\/["']\)\[1\]/g,
      JSON.stringify(interfaceName),
    )
    .replace(
      /\(window\.location\.pathname\)\.split\(["']\/["']\)\[1\]/g,
      JSON.stringify(interfaceName),
    );
}

function getContentType(path: string, upstreamContentType: string | null): string | null {
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return contentTypes[extname(path).toLowerCase()] || upstreamContentType;
}

function getCachedResource(key: string): CachedResource | null {
  const cached = resourceCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    resourceCache.delete(key);
    cachedBytes -= cached.body.byteLength;
    return null;
  }

  resourceCache.delete(key);
  resourceCache.set(key, cached);
  return cached;
}

function cacheResource(key: string, resource: CachedResource): void {
  const previous = resourceCache.get(key);
  if (previous) cachedBytes -= previous.body.byteLength;
  resourceCache.delete(key);
  resourceCache.set(key, resource);
  cachedBytes += resource.body.byteLength;

  while (
    resourceCache.size > MAX_CACHE_ENTRIES ||
    cachedBytes > MAX_CACHE_BYTES
  ) {
    const oldestKey = resourceCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = resourceCache.get(oldestKey);
    resourceCache.delete(oldestKey);
    if (oldest) cachedBytes -= oldest.body.byteLength;
  }
}

async function fetchResource(
  req: Request,
  upstream: { url: URL; isHtml: boolean },
): Promise<CachedResource> {
  const upstreamResponse = await fetch(upstream.url, {
    headers: {
      Accept: req.get("accept") || "*/*",
      "Accept-Language": req.get("accept-language") || "fr-FR,fr;q=0.9",
      "User-Agent": req.get("user-agent") || "Master-Class-Vittascience-Proxy",
    },
  });
  const contentType = getContentType(
    upstream.url.pathname,
    upstreamResponse.headers.get("content-type"),
  );
  const rawBody = Buffer.from(await upstreamResponse.arrayBuffer());
  const isTextAsset =
    contentType?.startsWith("text/") ||
    contentType?.startsWith("application/javascript") ||
    contentType?.startsWith("application/json");
  const rawText = isTextAsset ? rawBody.toString("utf8") : null;
  const body = upstream.isHtml && rawText
    ? Buffer.from(
        rewriteStandalonePaths(
          rewriteStandaloneHtml(rawText, upstream.url.pathname.split("/")[1]),
          upstream.url.pathname,
        ),
      )
    : rawText
      ? Buffer.from(rewriteStandalonePaths(rawText, upstream.url.pathname))
      : rawBody;
  const headers: Record<string, string> = {};

  for (const header of ["content-language", "etag", "last-modified", "expires"]) {
    const value = upstreamResponse.headers.get(header);
    if (value) headers[header] = value;
  }

  return {
    status: upstreamResponse.status,
    body,
    contentType,
    headers,
    expiresAt: Date.now() + (upstream.isHtml ? HTML_CACHE_TTL_MS : ASSET_CACHE_TTL_MS),
  };
}

async function getResource(
  req: Request,
  upstream: { url: URL; isHtml: boolean },
): Promise<CachedResource> {
  const key = upstream.url.toString();
  const cached = getCachedResource(key);
  if (cached) return cached;

  const pending = pendingResources.get(key);
  if (pending) return pending;

  const request = fetchResource(req, upstream)
    .then((resource) => {
      if (resource.status === 200) cacheResource(key, resource);
      return resource;
    })
    .finally(() => pendingResources.delete(key));
  pendingResources.set(key, request);
  return request;
}

function serializeModuleCatalogEntry(
  module: (typeof VITTASCIENCE_MODULE_CATALOG)[number],
) {
  return {
    slug: module.slug,
    label: module.label,
    source: {
      organization: "vittascience",
      repository: "interfaces",
      branch: "master",
      repositoryUrl: "https://github.com/vittascience/interfaces",
    },
    interfacePath: module.interfacePath,
    entrypoint: `${VITTASCIENCE_PROXY_PREFIX}/${module.interfacePath}/`,
    capabilities: module.capabilities,
  };
}

router.get("/modules", (_req: Request, res: Response) => {
  res
    .setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
    .json(VITTASCIENCE_MODULE_CATALOG.map(serializeModuleCatalogEntry));
});

router.get("/modules/:moduleSlug", (req: Request, res: Response) => {
  const module = VITTASCIENCE_MODULE_CATALOG.find(
    (candidate) => candidate.slug === req.params.moduleSlug,
  );

  if (!module) {
    res.status(404).json({ message: "Module Vittascience inconnu." });
    return;
  }

  res
    .setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
    .json(serializeModuleCatalogEntry(module));
});

router.use(async (req: Request, res: Response) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET, HEAD").end();
    return;
  }

  const upstream = getUpstreamUrl(req);
  if (!upstream) {
    res.status(404).json({ message: "Interface Vittascience inconnue." });
    return;
  }

  try {
    const resource = await getResource(req, upstream);
    for (const [header, value] of Object.entries(resource.headers)) {
      res.setHeader(header, value);
    }
    res.setHeader(
      "Cache-Control",
      upstream.isHtml
        ? "no-cache"
        : "public, max-age=300, stale-while-revalidate=3600",
    );
    res.status(resource.status);

    if (req.method === "HEAD" || resource.status === 204) {
      res.end();
      return;
    }

    if (resource.contentType) res.setHeader("Content-Type", resource.contentType);
    res.setHeader("Content-Length", resource.body.byteLength);
    res.end(resource.body);
  } catch (error) {
    req.log?.error(
      { err: error, url: upstream.url.toString() },
      "Vittascience repository proxy request failed",
    );
    res.status(502).json({ message: "Impossible de charger l’éditeur Vittascience." });
  }
});

export default router;