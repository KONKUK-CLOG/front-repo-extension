import { createPatch } from "diff";
import { ClogApiClient } from "../api/client";
import {
  createProjectFile,
  listProjectFiles,
  updateProjectFile,
  updateProjectFileDiff,
} from "../api/projects";
import { ProjectFileResponse } from "../api/types";
import {
  CachedFileEntry,
  ProjectSyncCache,
  getCachedFileEntry,
  saveProjectSyncCache,
  upsertCachedFileEntry,
} from "./projectSyncCache";
import {
  collectWorkspaceSourceFiles,
  getWorkspaceFolder,
  toWorkspaceRelativePath,
} from "./workspaceFiles";

export interface ProjectSyncResult {
  cache: ProjectSyncCache;
  created: number;
  skipped: number;
}

export async function syncEntireWorkspaceToServer(
  client: ClogApiClient,
  projectId: string,
  cache: ProjectSyncCache | null,
  log: (line: string) => void,
): Promise<ProjectSyncResult> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    throw new Error("워크스페이스 폴더가 없습니다.");
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  let skippedCollect = 0;
  const localFiles = await collectWorkspaceSourceFiles(workspaceFolder, {
    onSkip: (reason, relativePath) => {
      skippedCollect += 1;
      log(`[Initial Sync] skip collect (${reason}): ${relativePath}`);
    },
  });
  const remoteFiles = await listProjectFiles(client, projectId);
  const remoteByPath = new Map(
    remoteFiles.map((file) => [file.filePath, file]),
  );

  const nextCache: ProjectSyncCache = {
    projectId,
    workspaceRoot,
    files: cache?.projectId === projectId ? { ...cache.files } : {},
    syncedAt: new Date().toISOString(),
  };

  let created = 0;
  let skipped = 0;

  log(
    `[Initial Sync] workspace files=${localFiles.length} skippedCollect=${skippedCollect} remote=${remoteFiles.length}`,
  );

  for (const local of localFiles) {
    const remote = remoteByPath.get(local.relativePath);
    const cached = getCachedFileEntry(nextCache, local.relativePath);

    if (!remote) {
      log(`[Initial Sync] >>> POST .../files path=${local.relativePath}`);
      const saved = await createProjectFile(
        client,
        projectId,
        local.relativePath,
        local.language,
        local.content,
      );
      upsertCachedFileEntry(nextCache, {
        fileId: saved.id,
        relativePath: local.relativePath,
        language: local.language,
        baselineContent: local.content,
      });
      created += 1;
      log(`[Initial Sync] <<< POST OK fileId=${saved.id}`);
      continue;
    }

    if (cached?.baselineContent === local.content) {
      upsertCachedFileEntry(nextCache, {
        fileId: remote.id,
        relativePath: local.relativePath,
        language: local.language,
        baselineContent: local.content,
      });
      skipped += 1;
      continue;
    }

    if (!cached) {
      log(
        `[Initial Sync] >>> PUT full align (cache miss) path=${local.relativePath}`,
      );
      await updateProjectFile(client, projectId, remote.id, {
        content: local.content,
        language: local.language,
      });
    }

    upsertCachedFileEntry(nextCache, {
      fileId: remote.id,
      relativePath: local.relativePath,
      language: local.language,
      baselineContent: local.content,
    });
    skipped += 1;
  }

  return { cache: nextCache, created, skipped };
}

export interface FileDiffSyncResult {
  updated: boolean;
  patch?: string;
  file?: ProjectFileResponse;
}

export async function syncSavedFileDiffToServer(
  client: ClogApiClient,
  cache: ProjectSyncCache,
  relativePath: string,
  currentContent: string,
  language: string,
  log: (line: string) => void,
): Promise<{ cache: ProjectSyncCache; result: FileDiffSyncResult }> {
  const entry = getCachedFileEntry(cache, relativePath);

  if (!entry) {
    log(`[Ctrl+S] SKIP — cache에 없는 파일: ${relativePath}`);
    return { cache, result: { updated: false } };
  }

  if (entry.baselineContent === currentContent) {
    log(`[Ctrl+S] SKIP — 변경 없음: ${relativePath}`);
    return { cache, result: { updated: false } };
  }

  const patch = createPatch(
    relativePath,
    entry.baselineContent,
    currentContent,
    "synced baseline",
    "editor save",
  );

  log(`[Ctrl+S] >>> PUT .../files/${entry.fileId} contentDiff`);
  log(`[Ctrl+S] diff(patch):\n${patch}`);

  const saved = await updateProjectFileDiff(
    client,
    cache.projectId,
    entry.fileId,
    patch,
    language,
  );

  upsertCachedFileEntry(
    cache,
    {
      fileId: entry.fileId,
      relativePath,
      language,
      baselineContent: currentContent,
    },
    patch,
  );

  log(`[Ctrl+S] <<< diff 적용 OK path=${relativePath}`);

  return {
    cache,
    result: { updated: true, patch, file: saved },
  };
}

export async function ensureWorkspaceFileInCache(
  client: ClogApiClient,
  projectId: string,
  cache: ProjectSyncCache,
  relativePath: string,
  content: string,
  language: string,
  log: (line: string) => void,
): Promise<ProjectSyncCache> {
  const cached = getCachedFileEntry(cache, relativePath);
  if (cached) {
    return cache;
  }

  const remoteFiles = await listProjectFiles(client, projectId);
  const remote = remoteFiles.find((file) => file.filePath === relativePath);

  if (remote) {
    upsertCachedFileEntry(cache, {
      fileId: remote.id,
      relativePath,
      language,
      baselineContent: content,
    });
    log(`[Ctrl+S] cache 등록 (서버 기존 파일) path=${relativePath}`);
    return cache;
  }

  log(`[Ctrl+S] >>> POST .../files (캐시에 없던 파일) path=${relativePath}`);
  const saved = await createProjectFile(
    client,
    projectId,
    relativePath,
    language,
    content,
  );
  upsertCachedFileEntry(cache, {
    fileId: saved.id,
    relativePath,
    language,
    baselineContent: content,
  });
  log(`[Ctrl+S] <<< POST OK fileId=${saved.id}`);
  return cache;
}

export function resolveRelativePathForDocument(
  workspaceRoot: string,
  documentPath: string,
): string | null {
  if (!documentPath.startsWith(workspaceRoot)) {
    return null;
  }
  return toWorkspaceRelativePath(workspaceRoot, documentPath);
}
