import type { Room } from "./room";

/*
  Code that can run in two places — the API process, which owns the rooms, and a Trigger.dev task, which does
  not — asks this registry for a room. The API registers its RoomManager at boot; a task never does, so it
  falls back to the internal HTTP API. Keeping the registry free of runtime imports means a task bundle does
  not pull in storage, Postgres or Redis just to find out it has no local rooms.
 */
export interface LocalRooms {
    get(roomId: string): Room | undefined;
    getOrCreate(roomId: string): Promise<Room>;
}

let provider: LocalRooms | null = null;

export const registerLocalRooms = (rooms: LocalRooms | null): void => {
    provider = rooms;
};

/** The room, loading it if needed, when this process owns rooms; otherwise null. */
export const getLocalRoom = async (roomId: string): Promise<Room | null> => (provider ? provider.getOrCreate(roomId) : null);
