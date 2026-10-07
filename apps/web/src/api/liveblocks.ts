import API from "@/lib/api";

/*
  Liveblocks' auth handshake, sent through the shared axios instance so it carries the auth cookies
  and gets the same silent refresh as every other request. The server replies with Liveblocks' own
  token payload (`{ token }`), not the usual envelope.
 */
export const authorizeRoom = async (room: string | undefined): Promise<{ token: string }> => {
    const response = await API.post<{ token: string }>("/liveblocks/auth", { room });
    return response.data;
};
