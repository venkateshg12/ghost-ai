"use client";

import { memo } from "react";
import { useViewport } from "@xyflow/react";
import { useOthers } from "@/lib/realtime/react";
import CollaboratorCursor from "./CollaboratorCursor";

interface SingleCursorProps {
  connectionId: string;
  x: number;
  y: number;
  zoom: number;
  vpX: number;
  vpY: number;
}

const SingleCursor = memo(({ connectionId, x, y, zoom, vpX, vpY }: SingleCursorProps) => {
  const screenX = x * zoom + vpX;
  const screenY = y * zoom + vpY;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 will-change-transform"
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        transition: "transform 80ms ease-out",
      }}
    >
      <CollaboratorCursor connectionId={connectionId} />
    </div>
  );
});
SingleCursor.displayName = "SingleCursor";

export const CursorsLayer = () => {
  const others = useOthers((list) =>
    list
      .filter((other) => Boolean(other.presence?.cursor))
      .map((other) => ({
        connectionId: other.connectionId,
        cursor: other.presence.cursor!,
      }))
  );
  const { x: vpX, y: vpY, zoom } = useViewport();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {others.map(({ connectionId, cursor }) => (
        <SingleCursor
          key={connectionId}
          connectionId={connectionId}
          x={cursor.x}
          y={cursor.y}
          zoom={zoom}
          vpX={vpX}
          vpY={vpY}
        />
      ))}
    </div>
  );
};

export default CursorsLayer;
