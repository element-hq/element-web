/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../languageHandler";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import SdkConfig from "../SdkConfig";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import PlatformPeg from "../PlatformPeg";

const TOAST_KEY = "protocolhandler";

/**
 * Set once the user has interacted with the toast, so that we don't nag them about it again.
 */
const NAG_DISMISSED_KEY = "protocol_handler_nag_dismissed";

const onAccept = (): void => {
    // Hide first: registering the handler may hand off to the platform (and, on the web, to a
    // browser permission prompt) so we don't want the toast hanging around in the meantime.
    dismissNag();
    SettingsStore.setValue("protocolHandlerRegistered", null, SettingLevel.DEVICE, true).catch((err) => {
        logger.warn("Failed to register protocol handler", err);
    });
};

const onReject = (): void => {
    dismissNag();
};

function dismissNag(): void {
    localStorage.setItem(NAG_DISMISSED_KEY, "true");
    hideToast();
}

/**
 * Show a toast prompting the user to make this client the default handler for `matrix:` links,
 * if the deployment has opted into it via the `protocol_handler_nag_toast` config option.
 *
 * Does nothing if the platform can't register a protocol handler, if the handler is already
 * registered, or if the user has already been asked and made a choice.
 */
export const showToast = async (): Promise<void> => {
    if (!SdkConfig.get("protocol_handler_nag_toast")) return;
    if (localStorage.getItem(NAG_DISMISSED_KEY) === "true") return;
    if (SettingsStore.getValue("protocolHandlerRegistered")) return;

    const platform = PlatformPeg.get();
    if (!platform || !(await platform.supportsRegisterProtocolHandler())) return;

    const brand = SdkConfig.get().brand;
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("settings|protocolHandlerRegistered|display_name", { brand }),
        props: {
            description: _t("protocol_handler|toast_description", { brand }),
            primaryLabel: _t("protocol_handler|toast_accept"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: onReject,
        },
        component: GenericToast,
        priority: 20,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
