import { catchError } from "../utils/errors/catchError";
import { OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import { createTicketRequestSchema } from "@repo/types";
import { getRealtimeTicketService } from "../services/realtime.service";

export const getRealtimeTicketHandler = catchError(async (req, res) => {
    const data = createTicketRequestSchema.parse(req.body);
    const result = await getRealtimeTicketService(req.userId!, data.roomId);
    return res.status(OK).json(ok(result));
});
