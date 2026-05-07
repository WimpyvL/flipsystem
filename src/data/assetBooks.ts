import { getContentKind, getContentLabel, getFileName, normalizeTitle } from "../content";
import type { ContentPage, FlipbookItem } from "../types";

const assetUrls = import.meta.glob("../../assets/**/*", {
  eager: true,
  query: "?url",
  import: "default"
}) as Record<string, string>;

const makeAssetId = (path: string) =>
  path
    .toLowerCase()
    .replace(/\.[^.]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const assetPages: ContentPage[] = Object.entries(assetUrls)
  .map(([path, contentUrl]) => {
    const fileName = getFileName(path);
    const contentKind = getContentKind(fileName) as ContentPage["contentKind"];

    return {
      id: makeAssetId(path),
      title: normalizeTitle(fileName),
      description: `${getContentLabel(contentKind)} loaded from the local assets folder.`,
      contentUrl,
      contentKind,
      fileName
    };
  })
  .sort((left, right) => {
    if (left.contentKind === "pdf" && right.contentKind !== "pdf") {
      return -1;
    }
    if (left.contentKind !== "pdf" && right.contentKind === "pdf") {
      return 1;
    }
    return left.title.localeCompare(right.title);
  });

export const assetBooks: FlipbookItem[] = [
  {
    id: "aureus-magazine",
    title: "Aureus Magazine",
    description: "Magazine assembled from every supported file in the local assets folder.",
    contentKind: "magazine",
    pages: assetPages,
    pageCount: assetPages.length,
    source: "asset",
    createdAt: "2026-05-07T13:42:57.000Z"
  }
];
