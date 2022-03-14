// Parse the given window.location and return parameters that can be used when calling
// MatrixChat.showScreen(screen, params)
import { logger } from "matrix-js-sdk/src/logger";
import MatrixChatType from "matrix-react-sdk/src/components/structures/MatrixChat";

import { parseQsFromFragment } from "./url_utils";

let lastLocationHashSet: string = null;

export function getScreenFromLocation(location: Location) {
    const fragparts = parseQsFromFragment(location);
    return {
        screen: fragparts.location.substring(1),
        params: fragparts.params,
    };
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location: Location) {
    if (!window.matrixChat) return;

    logger.log("Routing URL ", location.href);
    const s = getScreenFromLocation(location);
    (window.matrixChat as MatrixChatType).showScreen(s.screen, s.params);
}

function onHashChange(ev: HashChangeEvent) {
    if (decodeURIComponent(window.location.hash) === lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
export function onNewScreen(screen: string, replaceLast = false) {
    logger.log("newscreen " + screen);
    const hash = '#/' + screen;
    lastLocationHashSet = hash;

    // if the new hash is a substring of the old one then we are stripping fields e.g `via` so replace history
    if (screen.startsWith("room/") &&
        window.location.hash.includes("/$") === hash.includes("/$") && // only if both did or didn't contain event link
        window.location.hash.startsWith(hash)
    ) {
        replaceLast = true;
    }

    if (replaceLast) {
        window.location.replace(hash);
    } else {
        window.location.assign(hash);
    }
}

// reload the page to a different url
export function reloadPage(newUrl: string) {
    console.log("reloadPage to " + newUrl);
    window.removeEventListener('hashchange', onHashChange);
    window.location.href = newUrl;
}

export function init() {
    window.addEventListener('hashchange', onHashChange);
}
