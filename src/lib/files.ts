export const MAX_FILE_COUNT = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateFiles(files: File[]): string | null {
  if (files.length === 0) {
    return "Add at least one document page.";
  }

  if (files.length > MAX_FILE_COUNT) {
    return `You can upload up to ${MAX_FILE_COUNT} pages at a time.`;
  }

  let totalBytes = 0;

  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return `"${file.name}" is not a supported image. Use PNG, JPG, or WebP.`;
    }

    if (file.size === 0) {
      return `"${file.name}" is empty.`;
    }

    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" is larger than ${formatFileSize(MAX_FILE_BYTES)}.`;
    }

    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    return `The combined document is larger than ${formatFileSize(MAX_TOTAL_BYTES)}.`;
  }

  return null;
}
