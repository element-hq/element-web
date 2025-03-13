/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { useCallback, useEffect, useRef } from "react";

import SettingsStore from "../settings/SettingsStore";

const debuglog = (...args: any[]): void => {
    if (SettingsStore.getValue("debug_animation")) {
        logger.log.call(console, "Animation debuglog:", ...args);
    }
};

export function useAnimation(enabled: boolean, callback: (timestamp: DOMHighResTimeStamp) => boolean): void {
    const handle = useRef<number | null>(null);

    const handler = useCallback(
        (timestamp: DOMHighResTimeStamp) => {
            if (callback(timestamp)) {
                handle.current = requestAnimationFrame(handler);
            } else {
                debuglog("Finished animation!");
            }
        },
        [callback],
    );

    useEffect(() => {
        debuglog("Started animation!");
        if (enabled) {
            handle.current = requestAnimationFrame(handler);
        }
        return () => {
            if (handle.current) {
                debuglog("Aborted animation!");
                cancelAnimationFrame(handle.current);
                handle.current = null;
            }
        };
    }, [enabled, handler]);
}
