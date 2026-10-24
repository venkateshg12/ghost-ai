import { RoomFeedManager } from "./feeds";
import { realtimeBus } from "./bus";
import { loadRoomDoc, saveRoomDoc } from "./persistence";
import type { RoomManagerDeps } from "./roomManager";

/** The production wiring: Redis bus, blob + Postgres persistence, Postgres feeds. */
export const defaultManagerDeps = (): RoomManagerDeps => ({
    bus: realtimeBus,
    load: loadRoomDoc,
    save: saveRoomDoc,
    createFeeds: (roomId, broadcast) => new RoomFeedManager(roomId, broadcast),
});
