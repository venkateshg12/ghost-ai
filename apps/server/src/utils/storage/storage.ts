import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BLOB_READ_WRITE_TOKEN, LOCAL_STORAGE_DIR } from "../../constants/env";

/*
  Large generated artifacts (canvas snapshots, Markdown specs) live here, never in Postgres. The
  database keeps only the reference this module returns.

  With BLOB_READ_WRITE_TOKEN set, objects go to Vercel Blob as PRIVATE blobs: the URL alone grants
  nothing, so every read goes through an access-checked route on this server. Without a token
  (local development) they are written under LOCAL_STORAGE_DIR and referenced as `local:<pathname>`.
 */
const LOCAL_PREFIX = "local:";
const useBlob = Boolean(BLOB_READ_WRITE_TOKEN);

// Pathnames are built by this server from ids it generated, but a reference read back from the
// database is still checked so it can never point outside the storage directory.
const localFilePath = (pathname: string) => {
    const root = path.resolve(LOCAL_STORAGE_DIR);
    const filePath = path.resolve(root, pathname);
    if (!filePath.startsWith(root + path.sep)) {
        throw new Error(`Refusing storage path outside ${root}: ${pathname}`);
    }
    return filePath;
};

/** Writes (or overwrites) an object and returns the reference to store in the database. */
export const putBytes = async (pathname: string, content: Buffer | string, contentType: string): Promise<string> => {
    if (useBlob) {
        const blob = await put(pathname, content, {
            access: "private",
            contentType,
            allowOverwrite: true,
            addRandomSuffix: false,
            token: BLOB_READ_WRITE_TOKEN,
        });
        return blob.url;
    }

    const filePath = localFilePath(pathname);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    return `${LOCAL_PREFIX}${pathname}`;
};

/** Reads an object by its stored reference, or `null` if it no longer exists. */
export const readBytes = async (reference: string): Promise<Buffer | null> => {
    if (reference.startsWith(LOCAL_PREFIX)) {
        try {
            return await readFile(localFilePath(reference.slice(LOCAL_PREFIX.length)));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw error;
        }
    }

    const result = await get(reference, { access: "private", token: BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
};

/** Text objects are bytes in UTF-8. */
export const putText = (pathname: string, content: string, contentType: string): Promise<string> => putBytes(pathname, content, contentType);

export const readText = async (reference: string): Promise<string | null> => (await readBytes(reference))?.toString("utf8") ?? null;

/** Best-effort delete; a missing object is not an error. */
export const removeObject = async (reference: string): Promise<void> => {
    if (reference.startsWith(LOCAL_PREFIX)) {
        await rm(localFilePath(reference.slice(LOCAL_PREFIX.length)), { force: true });
        return;
    }
    await del(reference, { token: BLOB_READ_WRITE_TOKEN });
};

export const storagePaths = {
    canvas: (projectId: string) => `canvas/${projectId}.json`,
    spec: (projectId: string, specId: string) => `specs/${projectId}/${specId}.md`,
    projectFolder: (projectId: string) => `specs/${projectId}`,
    canvasHistory: (projectId: string, runId: string) => `canvas-history/${projectId}/${runId}.json`,
    // Uploaded sketches. Deleted once the run that used them finishes.
    upload: (projectId: string, id: string, extension: string) => `uploads/${projectId}/${id}.${extension}`,
};
