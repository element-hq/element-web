/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "./index.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";

import { logger } from "matrix-js-sdk/src/logger";

import { getVectorConfig } from "../getconfig";

enum MobileAppVariant {
    Classic = "classic",
    X = "x",
    Pro = "pro",
}

interface AppMetadata {
    name: string;
    appleAppId: string;
    appStoreUrl: string;
    playStoreUrl: string;
    fDroidUrl?: string;
    deepLinkPath: string;
    usesLegacyDeepLink: boolean;
}

const appVariants: Record<MobileAppVariant, AppMetadata> = {
    [MobileAppVariant.Classic]: {
        name: "Element",
        appleAppId: "id1083446067",
        appStoreUrl: "https://apps.apple.com/app/element-messenger/id1083446067",
        playStoreUrl: "https://play.google.com/store/apps/details?id=im.vector.app",
        fDroidUrl: "https://f-droid.org/packages/im.vector.app",
        deepLinkPath: "",
        usesLegacyDeepLink: true,
    },
    [MobileAppVariant.X]: {
        name: "Element X",
        appleAppId: "id1631335820",
        appStoreUrl: "https://apps.apple.com/app/element-x-secure-chat-call/id1631335820",
        playStoreUrl: "https://play.google.com/store/apps/details?id=io.element.android.x",
        fDroidUrl: "https://f-droid.org/packages/io.element.android.x",
        deepLinkPath: "/element",
        usesLegacyDeepLink: false,
    },
    [MobileAppVariant.Pro]: {
        name: "Element Pro",
        appleAppId: "id6502951615",
        appStoreUrl: "https://apps.apple.com/app/element-pro-for-work/id6502951615",
        playStoreUrl: "https://play.google.com/store/apps/details?id=io.element.enterprise",
        deepLinkPath: "/element-pro",
        usesLegacyDeepLink: false,
    },
};

// NEVER pass user-controlled content to this function! Hardcoded strings only please.
function renderConfigError(message: string): void {
    const contactMsg =
        "If this is unexpected, please contact your system administrator " + "or technical support representative.";
    message = `<h2>Error loading Element</h2><p>${message}</p><p>${contactMsg}</p>`;

    const toHide = document.getElementsByClassName("mx_HomePage_container");
    const errorContainers = document.getElementsByClassName(
        "mx_HomePage_errorContainer",
    ) as HTMLCollectionOf<HTMLDivElement>;

    for (const e of toHide) {
        // We have to clear the content because .style.display='none'; doesn't work
        // due to an !important in the CSS.
        e.innerHTML = "";
    }
    for (const e of errorContainers) {
        e.style.display = "block";
        e.innerHTML = message;
    }
}

async function initPage(): Promise<void> {
    const config = await getVectorConfig("..");

    // We manually parse the config similar to how validateServerConfig works because
    // calling that function pulls in roughly 4mb of JS we don't use.

    const wkConfig = config?.["default_server_config"]; // overwritten later under some conditions
    let serverName = config?.["default_server_name"];
    const defaultHsUrl = config?.["default_hs_url"];
    const defaultIsUrl = config?.["default_is_url"];

    const appVariant = (config?.["mobile_guide_app_variant"] ?? "classic") as MobileAppVariant;
    const metadata = appVariants[appVariant];

    const incompatibleOptions = [wkConfig, serverName, defaultHsUrl].filter((i) => !!i);
    if (defaultHsUrl && (wkConfig || serverName)) {
        return renderConfigError(
            "Invalid configuration: a default_hs_url can't be specified along with default_server_name " +
                "or default_server_config",
        );
    }
    if (incompatibleOptions.length < 1) {
        return renderConfigError("Invalid configuration: no default server specified.");
    }

    let hsUrl: string | undefined;
    let isUrl: string | undefined;

    if (!serverName && typeof wkConfig?.["m.homeserver"]?.["base_url"] === "string") {
        hsUrl = wkConfig["m.homeserver"]["base_url"];
        serverName = wkConfig["m.homeserver"]["server_name"];

        if (typeof wkConfig["m.identity_server"]?.["base_url"] === "string") {
            isUrl = wkConfig["m.identity_server"]["base_url"];
        }
    }

    if (serverName) {
        // We also do our own minimal .well-known validation to avoid pulling in the js-sdk
        try {
            const result = await fetch(`https://${serverName}/.well-known/matrix/client`);
            const wkConfig = await result.json();
            if (wkConfig?.["m.homeserver"]) {
                hsUrl = wkConfig["m.homeserver"]["base_url"];

                if (wkConfig["m.identity_server"]) {
                    isUrl = wkConfig["m.identity_server"]["base_url"];
                }
            }
        } catch (e) {
            if (wkConfig?.["m.homeserver"]) {
                hsUrl = wkConfig["m.homeserver"]["base_url"] || undefined;

                if (wkConfig["m.identity_server"]) {
                    isUrl = wkConfig["m.identity_server"]["base_url"] || undefined;
                }
            } else {
                logger.error(e);
                return renderConfigError("Unable to fetch homeserver configuration");
            }
        }
    }

    if (defaultHsUrl) {
        hsUrl = defaultHsUrl;
        isUrl = defaultIsUrl;
    }

    if (!hsUrl) {
        return renderConfigError("Unable to locate homeserver");
    }

    if (hsUrl && !hsUrl.endsWith("/")) hsUrl += "/";
    if (isUrl && !isUrl.endsWith("/")) isUrl += "/";

    let deepLinkUrl = `https://mobile.element.io${metadata.deepLinkPath}`;

    if (metadata.usesLegacyDeepLink) {
        deepLinkUrl += `?hs_url=${encodeURIComponent(hsUrl)}`;
        if (isUrl) {
            deepLinkUrl += `&is_url=${encodeURIComponent(isUrl)}`;
        }
    } else if (serverName) {
        deepLinkUrl += `?account_provider=${serverName}`;
    }

    await updateDocument(metadata, deepLinkUrl, serverName, hsUrl);
}

async function updateDocument(
    metadata: AppMetadata,
    deepLinkUrl: string,
    serverName: string | undefined,
    hsUrl: string,
): Promise<void> {
    const appleMeta = document.querySelector('meta[name="apple-itunes-app"]') as Element;
    appleMeta.setAttribute("content", `app-id=${metadata.appleAppId}`);

    (document.getElementById("header_title") as HTMLHeadingElement).innerText =
        `Join ${serverName ?? hsUrl} on Element`;
    (document.getElementById("app_store_link") as HTMLAnchorElement).href = metadata.appStoreUrl;
    (document.getElementById("play_store_link") as HTMLAnchorElement).href = metadata.playStoreUrl;

    if (metadata.fDroidUrl) {
        (document.getElementById("f_droid_link") as HTMLAnchorElement).href = metadata.fDroidUrl;
    } else {
        document.getElementById("f_droid_section")!.style.display = "none";
    }

    (document.getElementById("deep_link_button") as HTMLAnchorElement).href = deepLinkUrl;
    document.getElementById("step1_heading")!.innerHTML = `Download ${metadata.name}`;
    document.getElementById("step2_container")!.style.display = "block";
}

void initPage();
