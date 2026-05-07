export type FlipbookSource = "asset" | "upload";
export type ContentKind = "magazine" | "pdf" | "image" | "video" | "audio" | "text" | "file";

export interface ContentPage {
  id: string;
  title: string;
  description: string;
  contentUrl: string;
  contentKind: Exclude<ContentKind, "magazine">;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface FlipbookItem {
  id: string;
  title: string;
  description: string;
  contentUrl?: string;
  contentKind: ContentKind;
  fileName?: string;
  pages?: ContentPage[];
  coverImageUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  pageCount: number;
  source: FlipbookSource;
  createdAt: string;
}
