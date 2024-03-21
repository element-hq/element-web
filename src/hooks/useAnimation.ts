/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
