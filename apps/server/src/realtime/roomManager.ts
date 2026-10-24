import type * as Y from "yjs";
import { Room, type RoomDeps } from "./room";
import type { Connection } from "./connection";
import { defaultManagerDeps } from "./defaults";

export interface RoomManagerDeps extends RoomDeps {
    load: (roomId: string) => Promise<Y.Doc>;
}

export class RoomManager {
    private rooms = new Map<string, Room>();
    private initPromises = new Map<string, Promise<Room>>();
    private readonly deps: RoomManagerDeps;

    constructor(deps: RoomManagerDeps = defaultManagerDeps()) {
        this.deps = deps;
    }

    async getOrCreateRoom(roomId: string): Promise<Room> {
        const existing = this.rooms.get(roomId);
        if (existing && !existing.destroyed) return existing;

        const inFlight = this.initPromises.get(roomId);
        if (inFlight) return inFlight;

        const promise = (async () => {
            const doc = await this.deps.load(roomId);
            const room: Room = new Room(
                roomId,
                doc,
                (evictedId) => {
                    // A replacement room for the same id must survive the old one's eviction.
                    if (this.rooms.get(evictedId) === room) this.rooms.delete(evictedId);
                },
                this.deps
            );
            this.rooms.set(roomId, room);
            return room;
        })();

        this.initPromises.set(roomId, promise);
        try {
            return await promise;
        } finally {
            this.initPromises.delete(roomId);
        }
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    async join(roomId: string, conn: Connection): Promise<void> {
        const room = await this.getOrCreateRoom(roomId);
        await room.join(conn);
    }

    leave(roomId: string, conn: Connection): void {
        this.rooms.get(roomId)?.leave(conn);
    }

    /** Closes this user's sockets in the room, here and on every other instance. */
    async kickUser(roomId: string, userId: string): Promise<void> {
        this.rooms.get(roomId)?.kickUser(userId);
        await this.deps.bus.publish(roomId, "kick", userId);
    }

    /** The project was deleted: close the room here and on every other instance. Nothing is saved. */
    async destroyRoom(roomId: string): Promise<void> {
        const room = this.rooms.get(roomId);
        if (room) {
            this.rooms.delete(roomId);
            room.destroy();
        }
        await this.deps.bus.publish(roomId, "destroy", null);
    }

    async flushAll(): Promise<void> {
        await Promise.allSettled(Array.from(this.rooms.values(), (room) => room.flush()));
    }

    stats(): { roomCount: number; connectionCount: number; updateBytes: number } {
        let connectionCount = 0;
        let updateBytes = 0;
        for (const room of this.rooms.values()) {
            const stats = room.stats();
            connectionCount += stats.connections;
            updateBytes += stats.updateBytes;
        }
        return { roomCount: this.rooms.size, connectionCount, updateBytes };
    }
}

export const roomManager = new RoomManager();
