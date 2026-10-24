import {
    REALTIME_LIMITS,
    presenceSchema,
    type Presence,
    type RealtimeUserInfo,
    type ServerPresenceChange,
} from "@repo/types";
import type { Connection } from "./connection";
import { AI_PARTICIPANT } from "./identity";

export interface ParticipantPresence {
    connectionId: string;
    userId: string;
    info: RealtimeUserInfo;
    presence: Presence;
    lastSeen: number;
    expiresAt?: number;
}

const toChange = (p: ParticipantPresence): ServerPresenceChange => ({
    connectionId: p.connectionId,
    userId: p.userId,
    info: p.info,
    presence: p.presence,
});

export class RoomPresenceManager {
    // Participants on this instance: sockets connected here, plus Plano when a task reported through us.
    private participants = new Map<string, ParticipantPresence>();
    // Participants other instances told us about over the bus, so a late joiner here still sees them.
    private remote = new Map<string, ServerPresenceChange>();
    private pendingChanges = new Map<string, ParticipantPresence>();
    private flushTimer?: NodeJS.Timeout;

    constructor(
        private readonly roomId: string,
        private readonly broadcast: (changes: ServerPresenceChange[]) => void,
        // Called when server-set presence (Plano) times out, so every socket drops the cursor.
        private readonly onExpire: (connectionId: string) => void = () => {}
    ) {
        this.flushTimer = setInterval(() => {
            this.expireStale();
            this.flushBatch();
        }, REALTIME_LIMITS.presenceIntervalMs);
        this.flushTimer.unref?.();
    }

    getSnapshot(): ServerPresenceChange[] {
        this.expireStale();
        return [...Array.from(this.participants.values(), toChange), ...this.remote.values()];
    }

    onClientPresence(conn: Connection, rawPresence: unknown): boolean {
        // Only `cursor` and `thinking` are read from the client. Identity always comes from the ticket.
        const parsed = presenceSchema.safeParse(rawPresence);
        if (!parsed.success) return false;

        const participant: ParticipantPresence = {
            connectionId: conn.id,
            userId: conn.userId,
            info: conn.userInfo,
            presence: parsed.data,
            lastSeen: Date.now(),
        };

        this.participants.set(conn.id, participant);
        this.pendingChanges.set(conn.id, participant);
        return true;
    }

    onClientJoin(conn: Connection): ServerPresenceChange {
        const participant: ParticipantPresence = {
            connectionId: conn.id,
            userId: conn.userId,
            info: conn.userInfo,
            presence: { cursor: null, thinking: false },
            lastSeen: Date.now(),
        };

        this.participants.set(conn.id, participant);
        this.pendingChanges.set(conn.id, participant);
        return toChange(participant);
    }

    onClientLeave(connectionId: string): void {
        this.participants.delete(connectionId);
        this.pendingChanges.delete(connectionId);
    }

    setAiPresence(presence: Presence, ttlSeconds = 120): void {
        const aiConnectionId = `ai:${AI_PARTICIPANT.id}`;
        const participant: ParticipantPresence = {
            connectionId: aiConnectionId,
            userId: AI_PARTICIPANT.id,
            info: { name: AI_PARTICIPANT.name, avatar: null, color: AI_PARTICIPANT.color },
            presence,
            lastSeen: Date.now(),
            expiresAt: Date.now() + ttlSeconds * 1000,
        };

        this.participants.set(aiConnectionId, participant);
        this.pendingChanges.set(aiConnectionId, participant);
    }

    /** Presence of the sockets connected to this instance (not what other instances reported). */
    getLocal(): ServerPresenceChange[] {
        this.expireStale();
        return Array.from(this.participants.values(), toChange);
    }

    /** Presence another instance broadcast. Kept for late joiners; the caller forwards it to local sockets. */
    applyRemote(changes: ServerPresenceChange[]): void {
        for (const change of changes) {
            if (!this.participants.has(change.connectionId)) this.remote.set(change.connectionId, change);
        }
    }

    removeRemote(connectionId: string): void {
        this.remote.delete(connectionId);
    }

    private expireStale(): void {
        const now = Date.now();
        for (const [id, p] of this.participants) {
            if (p.expiresAt !== undefined && p.expiresAt <= now) {
                this.participants.delete(id);
                this.pendingChanges.delete(id);
                this.onExpire(id);
            }
        }
    }

    flushBatch(): void {
        if (this.pendingChanges.size === 0) return;

        const changes = Array.from(this.pendingChanges.values(), toChange);
        this.pendingChanges.clear();
        this.broadcast(changes);
    }

    destroy(): void {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.participants.clear();
        this.remote.clear();
        this.pendingChanges.clear();
    }
}
