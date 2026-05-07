import type { ContentKind } from "./types";

const imageExtensions = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const videoExtensions = new Set(["avi", "m4v", "mkv", "mov", "mp4", "ogg", "ogv", "webm"]);
const audioExtensions = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "wav", "webm"]);
const textExtensions = new Set(["css", "csv", "html", "js", "json", "log", "md", "txt", "ts", "tsx", "xml", "yaml", "yml"]);

export const getFileName = (path: string) => decodeURIComponent(path.split(/[\\/]/).pop() ?? path);

export const getExtension = (filename: string) => {
  const cleanName = filename.split("?")[0] ?? filename;
  const extension = cleanName.includes(".") ? cleanName.split(".").pop() : "";
  return extension?.toLowerCase() ?? "";
};

export const normalizeTitle = (filename: string) =>
  filename
    .replace(/\.[^.]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

export const getContentKind = (filename: string, mimeType = ""): ContentKind => {
  const extension = getExtension(filename);
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (normalizedMime.startsWith("image/") || imageExtensions.has(extension)) {
    return "image";
  }
  if (normalizedMime.startsWith("video/") || videoExtensions.has(extension)) {
    return "video";
  }
  if (normalizedMime.startsWith("audio/") || audioExtensions.has(extension)) {
    return "audio";
  }
  if (normalizedMime.startsWith("text/") || textExtensions.has(extension)) {
    return "text";
  }

  return "file";
};

export const getContentLabel = (kind: ContentKind) => {
  switch (kind) {
    case "magazine":
      return "Magazine";
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "text":
      return "Text";
    default:
      return "File";
  }
};

export const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};
