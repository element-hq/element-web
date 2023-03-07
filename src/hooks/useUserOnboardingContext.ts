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
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { Notifier } from "../Notifier";
import DMRoomMap from "../utils/DMRoomMap";

export interface UserOnboardingContext {
    hasAvatar: boolean;
    hasDevices: boolean;
    hasDmRooms: boolean;
    hasNotificationsEnabled: boolean;
}

const USER_ONBOARDING_CONTEXT_INTERVAL = 5000;

/**
 * Returns a persistent, non-changing reference to a function
 * This function proxies all its calls to the current value of the given input callback
 *
 * This allows you to use the current value of e.g., a state in a callback that’s used by e.g., a useEventEmitter or
 * similar hook without re-registering the hook when the state changes
 * @param value changing callback
 */
function useRefOf<T extends any[], R>(value: (...values: T) => R): (...values: T) => R {
    const ref = useRef(value);
    ref.current = value;
    return useCallback((...values: T) => ref.current(...values), []);
}

function useUserOnboardingContextValue<T>(defaultValue: T, callback: (cli: MatrixClient) => Promise<T>): T {
    const [value, setValue] = useState<T>(defaultValue);
    const cli = MatrixClientPeg.get();

    const handler = useRefOf(callback);

    useEffect(() => {
        if (value) {
            return;
        }

        let handle: number | null = null;
        let enabled = true;
        const repeater = async (): Promise<void> => {
            if (handle !== null) {
                clearTimeout(handle);
                handle = null;
            }
            setValue(await handler(cli));
            if (enabled) {
                handle = window.setTimeout(repeater, USER_ONBOARDING_CONTEXT_INTERVAL);
            }
        };
        repeater().catch((err) => logger.warn("could not update user onboarding context", err));
        cli.on(ClientEvent.AccountData, repeater);
        return () => {
            enabled = false;
            cli.off(ClientEvent.AccountData, repeater);
            if (handle !== null) {
                clearTimeout(handle);
                handle = null;
            }
        };
    }, [cli, handler, value]);
    return value;
}

export function useUserOnboardingContext(): UserOnboardingContext {
    const hasAvatar = useUserOnboardingContextValue(false, async (cli) => {
        const profile = await cli.getProfileInfo(cli.getUserId()!);
        return Boolean(profile?.avatar_url);
    });
    const hasDevices = useUserOnboardingContextValue(false, async (cli) => {
        const myDevice = cli.getDeviceId();
        const devices = await cli.getDevices();
        return Boolean(devices.devices.find((device) => device.device_id !== myDevice));
    });
    const hasDmRooms = useUserOnboardingContextValue(false, async () => {
        const dmRooms = DMRoomMap.shared().getUniqueRoomsWithIndividuals() ?? {};
        return Boolean(Object.keys(dmRooms).length);
    });
    const hasNotificationsEnabled = useUserOnboardingContextValue(false, async () => {
        return Notifier.isPossible();
    });

    return useMemo(
        () => ({ hasAvatar, hasDevices, hasDmRooms, hasNotificationsEnabled }),
        [hasAvatar, hasDevices, hasDmRooms, hasNotificationsEnabled],
    );
}
