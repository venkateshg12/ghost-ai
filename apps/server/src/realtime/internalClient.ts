import { INTERNAL_API_SECRET, INTERNAL_API_URL } from "../constants/env";

/** A request to this API's /internal routes, authenticated with INTERNAL_API_SECRET. Used from Trigger.dev tasks. */
export const internalFetch = (endpoint: string, options: RequestInit = {}): Promise<Response> =>
    fetch(`${INTERNAL_API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${INTERNAL_API_SECRET}`,
        },
    });
