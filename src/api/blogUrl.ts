import * as vscode from "vscode";

/** S3 정적 웹 호스팅 — 발행 글 SPA */
export const DEFAULT_BLOG_PUBLIC_ORIGIN =
  "http://clog-frontend-project.s3-website.ap-northeast-2.amazonaws.com";

export function getBlogPublicOrigin(): string {
  const configured = vscode.workspace
    .getConfiguration("clog")
    .get<string>("blogPublicBaseUrl")
    ?.trim();

  return normalizeBlogOrigin(configured || DEFAULT_BLOG_PUBLIC_ORIGIN);
}

/**
 * 발행된 블로그 공개 URL — SPA hash 라우트 `/#/blog/{id}`
 * API가 반환한 blogUrl(백엔드 도메인)은 사용하지 않고 프론트 origin으로 고정한다.
 */
export function formatPublishedBlogUrl(
  blogId: number,
  _blogUrlFromApi?: string,
): string {
  return `${getBlogPublicOrigin()}/#/blog/${blogId}`;
}

function normalizeBlogOrigin(base: string): string {
  const trimmed = base.replace(/\/$/, "");
  if (trimmed.endsWith("/blog")) {
    return trimmed.slice(0, -"/blog".length);
  }
  return trimmed;
}
