declare global {
  interface Liveblocks {
    // Each user's Presence, shared in real-time in a room
    Presence: {
      cursor: { x: number; y: number } | null
      thinking: boolean
      isThinking: boolean
    }

    // The Storage tree for the room. `@liveblocks/react-flow` manages its own `flow` key.
    Storage: {}

    // User metadata, set by the API's /liveblocks/auth route after its membership check
    UserMeta: {
      id: string
      info: {
        name: string
        avatar: string
        color: string
      }
    }

    // No broadcast events: chat and AI status use the room's feeds (`ai-chat`, `ai-status-feed`)
    RoomEvent: never

    RoomMetadata: {}
  }
}

export {}
