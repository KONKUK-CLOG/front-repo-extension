import { ClogApiClient } from "./client";
import { ProjectFileResponse, ProjectResponse } from "./types";

export async function listProjects(
  client: ClogApiClient,
): Promise<ProjectResponse[]> {
  return client.request<ProjectResponse[]>("/api/projects");
}

export async function createProject(
  client: ClogApiClient,
  name: string,
  description?: string,
): Promise<ProjectResponse> {
  return client.request<ProjectResponse>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteProject(
  client: ClogApiClient,
  projectId: string,
): Promise<void> {
  await client.requestVoid(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function listProjectFiles(
  client: ClogApiClient,
  projectId: string,
): Promise<ProjectFileResponse[]> {
  return client.request<ProjectFileResponse[]>(
    `/api/projects/${projectId}/files`,
  );
}

export async function createProjectFile(
  client: ClogApiClient,
  projectId: string,
  filePath: string,
  language: string,
  content: string,
): Promise<ProjectFileResponse> {
  return client.request<ProjectFileResponse>(
    `/api/projects/${projectId}/files`,
    {
      method: "POST",
      body: JSON.stringify({ filePath, language, content }),
    },
  );
}

export interface ProjectFileUpdateBody {
  filePath?: string;
  language?: string;
  content?: string;
  contentDiff?: string;
}

export async function updateProjectFile(
  client: ClogApiClient,
  projectId: string,
  fileId: string,
  patch: ProjectFileUpdateBody,
): Promise<ProjectFileResponse> {
  return client.request<ProjectFileResponse>(
    `/api/projects/${projectId}/files/${fileId}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
  );
}

export async function updateProjectFileDiff(
  client: ClogApiClient,
  projectId: string,
  fileId: string,
  contentDiff: string,
  language?: string,
): Promise<ProjectFileResponse> {
  return updateProjectFile(client, projectId, fileId, {
    contentDiff,
    ...(language ? { language } : {}),
  });
}

export async function ensureWorkspaceProject(
  client: ClogApiClient,
  workspaceName: string,
): Promise<ProjectResponse> {
  const projects = await listProjects(client);
  const existing = projects.find((project) => project.name === workspaceName);

  if (existing) {
    return existing;
  }

  return createProject(
    client,
    workspaceName,
    "VS Code Extension workspace project",
  );
}

export async function upsertProjectFile(
  client: ClogApiClient,
  projectId: string,
  filePath: string,
  language: string,
  content: string,
): Promise<ProjectFileResponse> {
  const files = await listProjectFiles(client, projectId);
  const existing = files.find((file) => file.filePath === filePath);

  if (existing) {
    return updateProjectFile(client, projectId, existing.id, {
      language,
      content,
    });
  }

  return createProjectFile(client, projectId, filePath, language, content);
}
