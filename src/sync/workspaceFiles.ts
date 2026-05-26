import * as path from "path";
import * as vscode from "vscode";

/** 서버 `app.project.max-file-bytes` 와 맞춤 (기본 50KB) */
export const MAX_FILE_BYTES = 51_200;

const ALL_FILES_GLOB = "**/*";

const EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,.next,coverage,target,bin,obj,.gradle,.idea,.vscode-test,venv,.venv,__pycache__,.turbo,.cache}/**";

/** 바이너리·대용량 에셋 — 텍스트 동기화 제외 */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".jar",
  ".war",
  ".class",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".sqlite",
  ".db",
  ".lock",
]);

export interface WorkspaceSourceFile {
  relativePath: string;
  absolutePath: string;
  language: string;
  content: string;
}

export interface CollectWorkspaceFilesOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  onSkip?: (reason: string, relativePath: string) => void;
}

/** 서버 `@NotBlank` — 빈 문자열·공백만 있는 content는 업로드 불가 */
export function isSyncableFileContent(content: string): boolean {
  return content.trim().length > 0;
}

const EXTENSION_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".swift": "swift",
  ".md": "markdown",
  ".json": "json",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "html",
  ".htm": "html",
  ".vue": "vue",
  ".svelte": "svelte",
  ".sql": "sql",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".properties": "properties",
  ".gradle": "gradle",
  ".dockerfile": "dockerfile",
};

export function getDefaultMaxSyncFiles(): number {
  return vscode.workspace
    .getConfiguration("clog")
    .get<number>("maxProjectSyncFiles", 10_000);
}

export function toWorkspaceRelativePath(
  workspaceRoot: string,
  absolutePath: string,
): string {
  const relative = path.relative(workspaceRoot, absolutePath);
  return relative.split(path.sep).join("/");
}

function resolveLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base === "dockerfile") {
    return "dockerfile";
  }
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE[ext] ?? "plaintext";
}

function shouldSkipPath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith(".")) {
    return "hidden-or-root";
  }
  const segments = normalized.split("/");
  if (
    segments.some((seg) =>
      [
        "node_modules",
        ".git",
        "dist",
        "build",
        "out",
        ".next",
        "coverage",
        "target",
      ].includes(seg),
    )
  ) {
    return "excluded-directory";
  }
  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return "binary-extension";
  }
  return null;
}

/**
 * 워크스페이스 내 **모든 파일** 수집 (제외 디렉터리·바이너리·크기 한도만 적용).
 */
export async function collectWorkspaceSourceFiles(
  workspaceFolder: vscode.WorkspaceFolder,
  options?: CollectWorkspaceFilesOptions,
): Promise<WorkspaceSourceFile[]> {
  const maxFiles = options?.maxFiles ?? getDefaultMaxSyncFiles();
  const maxFileBytes = options?.maxFileBytes ?? MAX_FILE_BYTES;
  const onSkip = options?.onSkip;

  const pattern = new vscode.RelativePattern(workspaceFolder, ALL_FILES_GLOB);
  const uris = await vscode.workspace.findFiles(
    pattern,
    new vscode.RelativePattern(workspaceFolder, EXCLUDE_GLOB),
    maxFiles,
  );

  const files: WorkspaceSourceFile[] = [];

  for (const uri of uris) {
    const absolutePath = uri.fsPath;
    const relativePath = toWorkspaceRelativePath(
      workspaceFolder.uri.fsPath,
      absolutePath,
    );

    const skipReason = shouldSkipPath(relativePath);
    if (skipReason) {
      onSkip?.(skipReason, relativePath);
      continue;
    }

    let content: Uint8Array;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.Directory) {
        continue;
      }
      content = await vscode.workspace.fs.readFile(uri);
    } catch {
      onSkip?.("read-failed", relativePath);
      continue;
    }

    if (content.byteLength > maxFileBytes) {
      onSkip?.("too-large", relativePath);
      continue;
    }

    if (content.byteLength === 0) {
      onSkip?.("empty-file", relativePath);
      continue;
    }

    const text = Buffer.from(content).toString("utf8");
    if (text.includes("\u0000")) {
      onSkip?.("binary-content", relativePath);
      continue;
    }

    files.push({
      relativePath,
      absolutePath,
      language: resolveLanguage(relativePath),
      content: text,
    });
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

export function getWorkspaceFolder():
  | vscode.WorkspaceFolder
  | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
