/** One structured JSON line per realtime event, so a log collector can filter on `scope` and `event`. */
export const rtLog = (event: string, fields: Record<string, unknown> = {}): void => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "realtime", event, ...fields }));
};
