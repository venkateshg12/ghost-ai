import type { ImageType } from "@repo/types";

/*
  What an upload actually is, judged by its first bytes. The Content-Type header is whatever the client
  chose to send, so it is only trusted when it agrees with the bytes.
 */
export const detectImageType = (bytes: Buffer): ImageType | null => {
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return null;
};

export const EXTENSION: Record<ImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
