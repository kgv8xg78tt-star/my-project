export type Manager = { id: string; fio: string; phone: string };

export type ProjectLayout = { id: string; label: string; imageUrl: string };

export type ProjectPackage = {
  id: string;
  name: string;
  description: string;
  priceRub: number;
};

export type Project = {
  id: string;
  name: string;
  title: string;
  renderUrls: string[];
  layouts: ProjectLayout[];
  packages: ProjectPackage[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  renderUrls: string[];
};

export type CommercialOfferRequest = {
  projectId: string;
  layoutId: string;
  packageId: string;
  managerId: string;
  fio: string;
  phone: string;
};

export type CommercialOfferResponse = {
  blob: Blob;
  filename?: string;
};

export type ApiError = {
  error: string;
};

function parseFilenameFromContentDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  // attachment; filename="..."
  const match = value.match(/filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i);
  return match?.[1];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export async function fetchProjects(): Promise<{ projects: ProjectSummary[] }> {
  return requestJson("/api/projects");
}

export async function fetchProjectDetails(projectId: string): Promise<{ project: Project }> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}`);
}

export async function fetchManagers(): Promise<{ managers: Manager[] }> {
  return requestJson("/api/managers");
}

export async function generateCommercialOfferPdf(
  payload: CommercialOfferRequest,
): Promise<CommercialOfferResponse> {
  const res = await fetch("/api/commercial-offers/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `PDF request failed: ${res.status}`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = parseFilenameFromContentDisposition(res.headers.get("Content-Disposition"));
  return { blob, filename };
}
