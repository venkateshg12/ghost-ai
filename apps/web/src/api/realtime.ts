import API from "@/lib/api";
import type { SuccessResponse } from "@/types";
import type { TicketResponse } from "@repo/types";

export const getRealtimeTicket = async (roomId: string): Promise<TicketResponse> => {
    const response = await API.post<SuccessResponse<TicketResponse>>("/realtime/ticket", { roomId });
    return response.data.data;
};
