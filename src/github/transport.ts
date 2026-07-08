interface GitHubJsonPage {
  data: unknown;
  nextUrl?: string;
}

type GitHubJsonTransportResult = GitHubJsonPage | unknown;

export interface GitHubJsonTransport {
  getJson(url: string, headers: Record<string, string>): Promise<GitHubJsonTransportResult>;
}

export interface GitHubTextTransport {
  getText(url: string, headers: Record<string, string>): Promise<string>;
}

export const defaultGitHubTransport: GitHubJsonTransport = {
  getJson: async (url, headers) => {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return {
      data: await response.json(),
      nextUrl: parseNextLinkUrl(response.headers.get("link"))
    };
  }
};

export const defaultGitHubTextTransport: GitHubTextTransport = {
  getText: async (url, headers) => {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
};

// GitHub list endpoints return later pages through a Link header, not a body field, so callers
// hand this a single starting URL and get every page merged back into one response shape.
export async function fetchMergedJsonPages(
  url: string,
  headers: Record<string, string>,
  transport: GitHubJsonTransport
): Promise<unknown> {
  const pages: unknown[] = [];
  const seenUrls = new Set<string>();
  let nextUrl: string | undefined = url;

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) {
      throw new Error(`GitHub API pagination loop detected at ${nextUrl}`);
    }

    seenUrls.add(nextUrl);
    const page = normalizeJsonPage(await transport.getJson(nextUrl, headers));
    pages.push(page.data);
    nextUrl = page.nextUrl;
  }

  return mergeJsonPages(pages);
}

function normalizeJsonPage(result: GitHubJsonTransportResult): GitHubJsonPage {
  if (isJsonPageEnvelope(result)) {
    return {
      data: result.data,
      nextUrl: typeof result.nextUrl === "string" ? result.nextUrl : undefined
    };
  }

  return { data: result };
}

function isJsonPageEnvelope(value: unknown): value is GitHubJsonPage {
  // Real transport wraps JSON with pagination metadata; tests may pass raw GitHub JSON directly.
  return (
    isRecord(value) &&
    "data" in value &&
    !("check_runs" in value) &&
    !("jobs" in value) &&
    !("workflow_runs" in value)
  );
}

function mergeJsonPages(pages: unknown[]): unknown {
  const firstPage = pages[0];

  if (pages.length <= 1 || !isRecord(firstPage)) {
    return firstPage;
  }

  // Only merge the list shapes callers request; unknown response shapes stay unchanged.
  for (const key of ["check_runs", "jobs", "workflow_runs"]) {
    if (Array.isArray(firstPage[key])) {
      return {
        ...firstPage,
        [key]: pages.flatMap((page) => (isRecord(page) && Array.isArray(page[key]) ? page[key] : []))
      };
    }
  }

  return firstPage;
}

function parseNextLinkUrl(linkHeader: string | null): string | undefined {
  if (!linkHeader) {
    return undefined;
  }

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
