import * as vscode from "vscode";

export function getApiBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("clog")
    .get<string>("apiBaseUrl", "https://clog.r-e.kr")
    .trim()
    .replace(/\/$/, "");
}
