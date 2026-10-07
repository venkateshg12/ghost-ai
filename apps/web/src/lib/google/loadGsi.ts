const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiPromise: Promise<void> | null = null;

/** Loads Google Identity Services once per page, injecting the script on first use. */
export function loadGoogleSdk(): Promise<void> {
    if (gsiPromise) return gsiPromise;

    gsiPromise = new Promise((resolve, reject) => {
        // Already loaded (e.g. hot reload, multiple mounts)
        if (window.google?.accounts?.id) {
            resolve();
            return;
        }

        let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        if (!script) {
            script = document.createElement("script");
            script.src = GSI_SRC;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        script.addEventListener("load", () => resolve());
        script.addEventListener("error", () => {
            gsiPromise = null;
            reject(new Error("Failed to load Google Identity Services script"));
        });
    });

    return gsiPromise;
}
