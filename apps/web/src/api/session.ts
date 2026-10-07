import API from "@/lib/api";
import type { MessageResponse, SessionSummary, SuccessResponse } from "@/types";

// Every session this account currently has open, newest first, with the current one flagged.
export const getSessions = async (): Promise<SuccessResponse<SessionSummary[]>> => {
    const response = await API.get<SuccessResponse<SessionSummary[]>>("/session");
    return response.data;
};

// Signs that device out. The server scopes the delete to the caller's own sessions.
export const revokeSession = async (sessionId: string): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.delete<SuccessResponse<MessageResponse>>(`/session/${sessionId}`);
    return response.data;
};
