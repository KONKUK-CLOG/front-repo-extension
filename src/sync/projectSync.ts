import { createPatch } from "diff";
import { ApiError, ClogApiClient } from "../api/client";
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
  isSyncableFileContent,
  toWorkspaceRelativePath,
} from "./workspaceFiles";

export interface ProjectSyncResult {
  cache: ProjectSyncCache;
  created: number;
  skipped: number;
  failed: string[];
}

function buildRemoteByPath(
  remoteFiles: ProjectFileResponse[],
): Map<string, ProjectFileResponse> {
  return new Map(remoteFiles.map((file) => [file.filePath, file]));
}

async function refreshRemoteAfterConflict(
  client: ClogApiClient,
  projectId: string,
): Promise<Map<string, ProjectFileResponse>> {
  const remoteFiles = await listProjectFiles(client, projectId);
  return buildRemoteByPath(remoteFiles);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withSyncRetry<T>(
  operation: () => Promise<T>,
  log: (line: string) => void,
  relativePath: string,
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (
        error instanceof ApiError &&
        error.status === 429 &&
        attempt < maxAttempts
      ) {
        const waitMs = 400 * attempt;
        log(
          `[Initial Sync] rate limit path=${relativePath}, retry in ${waitMs}ms (${attempt}/${maxAttempts})`,
        );
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
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
  let remoteFiles = await listProjectFiles(client, projectId);
  let remoteByPath = buildRemoteByPath(remoteFiles);

  const nextCache: ProjectSyncCache = {
    projectId,
    workspaceRoot,
    files: cache?.projectId === projectId ? { ...cache.files } : {},
    syncedAt: new Date().toISOString(),
  };

  let created = 0;
  let skipped = 0;
  const failed: string[] = [];

  log(
    `[Initial Sync] workspace files=${localFiles.length} skippedCollect=${skippedCollect} remote=${remoteFiles.length}`,
  );

  for (const local of localFiles) {
    if (!isSyncableFileContent(local.content)) {
      log(
        `[Initial Sync] skip sync (empty-content): ${local.relativePath}`,
      );
      skipped += 1;
      continue;
    }

    let remote = remoteByPath.get(local.relativePath);
    const cached = getCachedFileEntry(nextCache, local.relativePath);

    try {
      if (!remote) {
        log(`[Initial Sync] >>> POST .../files path=${local.relativePath}`);
        try {
          const saved = await withSyncRetry(
            () =>
              createProjectFile(
                client,
                projectId,
                local.relativePath,
                local.language,
                local.content,
              ),
            log,
            local.relativePath,
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
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            remoteByPath = await refreshRemoteAfterConflict(client, projectId);
            remote = remoteByPath.get(local.relativePath);
            if (remote) {
              log(
                `[Initial Sync] already on server (409) path=${local.relativePath} fileId=${remote.id}`,
              );
              upsertCachedFileEntry(nextCache, {
                fileId: remote.id,
                relativePath: local.relativePath,
                language: local.language,
                baselineContent: local.content,
              });
              skipped += 1;
              continue;
            }
          }
          throw error;
        }
        continue;
      }

      const remoteFile =
        remote ?? remoteByPath.get(local.relativePath);
      if (!remoteFile) {
        failed.push(local.relativePath);
        continue;
      }

      if (cached?.baselineContent === local.content) {
        upsertCachedFileEntry(nextCache, {
          fileId: remoteFile.id,
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
        await withSyncRetry(
          () =>
            updateProjectFile(client, projectId, remoteFile.id, {
              content: local.content,
              language: local.language,
            }),
          log,
          local.relativePath,
        );
      }

      upsertCachedFileEntry(nextCache, {
        fileId: remoteFile.id,
        relativePath: local.relativePath,
        language: local.language,
        baselineContent: local.content,
      });
      skipped += 1;
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "파일 동기화에 실패했습니다.";
      failed.push(local.relativePath);
      log(`[Initial Sync] error path=${local.relativePath}: ${message}`);
    }
  }

  return { cache: nextCache, created, skipped, failed };
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

  if (!isSyncableFileContent(content)) {
    log(
      `[Ctrl+S] SKIP — 빈 파일은 서버에 등록할 수 없음: ${relativePath}`,
    );
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
