import { orm } from "../prisma/db";
import appAssert from "../utils/errors/appAssert";
import { NOT_FOUND } from "../constants/http";
import { ensureRoom, getUserColor, liveblocks } from "../utils/liveblocks";
import { assertProjectAccess } from "./project.service";

/*
  Issues a room token after checking project membership here, in our own database. Using access
  tokens (rather than ID tokens + room permissions) means a collaborator gets in the moment they're
  invited — there is no second permission list in Liveblocks to keep in sync.
 */
export const authorizeRoomService = async (userId: string, roomId: string) => {
    await assertProjectAccess(roomId, userId);

    const user = await orm.User.where({ id: userId }).select("name", "email", "avatar").first();
    appAssert(user, NOT_FOUND, "User not found");

    await ensureRoom(roomId);

    const session = liveblocks.prepareSession(userId, {
        userInfo: {
            name: user.name || user.email.split("@")[0] || "Collaborator",
            avatar: user.avatar ?? "",
            color: getUserColor(userId),
        },
    });
    session.allow(roomId, session.FULL_ACCESS);

    return session.authorize();
};
