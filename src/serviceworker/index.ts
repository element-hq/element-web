const serverSupportMap: {
    [serverUrl: string]: {
        supportsMSC3916: boolean;
        cacheExpires: number;
    };
} = {};

const credentialStore: {
    [serverUrl: string]: string;
} = {};

// We skipWaiting() to update the service worker more frequently, particularly in development environments.
// @ts-expect-error - service worker types are not available. See 'fetch' event handler.
skipWaiting();

self.addEventListener("message", (event) => {
    if (event.data?.type !== "credentials") return; // ignore
    credentialStore[event.data.homeserverUrl] = event.data.accessToken;
    console.log(
        `[Service Worker] Updated access token for ${event.data.homeserverUrl} (accessToken? ${Boolean(event.data.accessToken)})`,
    );
});

// @ts-expect-error - getting types to work for this is difficult, so we anticipate that "addEventListener" doesn't
// have a valid signature.
self.addEventListener("fetch", (event: FetchEvent) => {
    // This is the authenticated media (MSC3916) check, proxying what was unauthenticated to the authenticated variants.

    if (event.request.method !== "GET") {
        return; // not important to us
    }

    // Note: ideally we'd keep the request headers and etc, but in practice we can't even see those details.
    // See https://stackoverflow.com/a/59152482
    let url = event.request.url;

    // We only intercept v3 download and thumbnail requests as presumably everything else is deliberate.
    // For example, `/_matrix/media/unstable` or `/_matrix/media/v3/preview_url` are something well within
    // the control of the application, and appear to be choices made at a higher level than us.
    if (url.includes("/_matrix/media/v3/download") || url.includes("/_matrix/media/v3/thumbnail")) {
        // We need to call respondWith synchronously, otherwise we may never execute properly. This means
        // later on we need to proxy the request through if it turns out the server doesn't support authentication.
        event.respondWith(
            (async (): Promise<Response> => {
                // Figure out which homeserver we're communicating with
                const csApi = url.substring(0, url.indexOf("/_matrix/media/v3"));

                // Locate our access token, and populate the fetchConfig with the authentication header.
                const accessToken = credentialStore[csApi];
                let fetchConfig: { headers?: { [key: string]: string } } = {};
                if (accessToken) {
                    fetchConfig = {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    };
                }

                // Update or populate the server support map using a (usually) authenticated `/versions` call.
                if (!serverSupportMap[csApi] || serverSupportMap[csApi].cacheExpires <= new Date().getTime()) {
                    const versions = await (await fetch(`${csApi}/_matrix/client/versions`, fetchConfig)).json();
                    serverSupportMap[csApi] = {
                        supportsMSC3916: Boolean(versions?.unstable_features?.["org.matrix.msc3916"]),
                        cacheExpires: new Date().getTime() + 2 * 60 * 60 * 1000, // 2 hours from now
                    };
                }

                // If we have server support (and a means of authentication), rewrite the URL to use MSC3916 endpoints.
                if (serverSupportMap[csApi].supportsMSC3916 && accessToken) {
                    // Currently unstable only.
                    url = url.replace(/\/media\/v3\/(.*)\//, "/client/unstable/org.matrix.msc3916/media/$1/");
                } // else by default we make no changes

                // Add authentication and send the request. We add authentication even if MSC3916 endpoints aren't
                // being used to ensure patches like this work:
                // https://github.com/matrix-org/synapse/commit/2390b66bf0ec3ff5ffb0c7333f3c9b239eeb92bb
                return fetch(url, fetchConfig);
            })(),
        );
    }
});
