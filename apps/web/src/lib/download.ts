import API from "@/lib/api";

/*
  Downloads go through the API (cookies + access check), not a bare link to storage, so the file is
  fetched as a blob and handed to the browser from memory.
 */
export const downloadFromApi = async (path: string, fallbackName: string) => {
  const response = await API.get<Blob>(path, { responseType: "blob" });

  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const fileName = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
