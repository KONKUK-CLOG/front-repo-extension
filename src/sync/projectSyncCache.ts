import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface CachedFileEntry {
  fileId: string;
  relativePath: string;
  language: string;
  baselineContent: string;
  lastDiff?: string;
}

export interface ProjectSyncCache {
  projectId: string;
  workspaceRoot: string;
  files: Record<string, CachedFileEntry>;
  syncedAt: string;
}

export function loadProjectSyncCache(
  cacheFileUri: vscode.Uri,
): ProjectSyncCache | null {
  if (!fs.existsSync(cacheFileUri.fsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(cacheFileUri.fsPath, "utf8");
    return JSON.parse(raw) as ProjectSyncCache;
  } catch {
    return null;
  }
}

export function saveProjectSyncCache(
  cacheFileUri: vscode.Uri,
  cache: ProjectSyncCache,
): void {
  fs.mkdirSync(path.dirname(cacheFileUri.fsPath), { recursive: true });
  fs.writeFileSync(cacheFileUri.fsPath, JSON.stringify(cache, null, 2), "utf8");
}

export function getCachedFileEntry(
  cache: ProjectSyncCache,
  relativePath: string,
): CachedFileEntry | undefined {
  return cache.files[relativePath];
}

export function isProjectSyncCacheValid(
  cache: ProjectSyncCache | null | undefined,
  projectId: string | undefined,
  workspaceRoot: string | undefined,
): boolean {
  if (!cache || !projectId || !workspaceRoot) {
    return false;
  }
  return (
    cache.projectId === projectId && cache.workspaceRoot === workspaceRoot
  );
}

export function upsertCachedFileEntry(
  cache: ProjectSyncCache,
  entry: CachedFileEntry,
  lastDiff?: string,
): void {
  cache.files[entry.relativePath] = {
    ...entry,
    ...(lastDiff ? { lastDiff } : {}),
  };
  cache.syncedAt = new Date().toISOString();
}
