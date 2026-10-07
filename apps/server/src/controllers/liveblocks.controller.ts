import z from "zod";
import { projectIdSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { authorizeRoomService } from "../services/liveblocks.service";

const roomAuthSchema = z.object({ room: projectIdSchema });

/*
  Answers Liveblocks' auth handshake. The body Liveblocks expects back is its own token payload, so
  this is the one route that returns Liveblocks' response as-is rather than the `ok()` envelope.
 */
export const liveblocksAuthHandler = catchError(async (req, res) => {
    const { room } = roomAuthSchema.parse(req.body);
    const { status, body } = await authorizeRoomService(req.userId, room);
    return res.status(status).type("application/json").send(body);
});
