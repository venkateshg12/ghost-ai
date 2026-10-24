import { assertProjectAccess } from "./project.service";
import { orm } from "../prisma/db";
import { getUserColor } from "../realtime/identity";
import { issueTicket } from "../realtime/tickets";
import appAssert from "../utils/errors/appAssert";
import { NOT_FOUND } from "../constants/http";
import type { TicketResponse } from "@repo/types";

export const getRealtimeTicketService = async (
    userId: string,
    roomId: string
): Promise<TicketResponse> => {
    await assertProjectAccess(roomId, userId);

    const user = await orm.User.where({ id: userId }).select("name", "avatar").first();
    appAssert(user, NOT_FOUND, "User not found");

    const color = getUserColor(userId);
    const ticket = await issueTicket({
        userId,
        roomId,
        userInfo: {
            name: user.name || "Anonymous",
            avatar: user.avatar || null,
            color,
        },
    });

    return {
        ticket,
        url: "/realtime",
    };
};
