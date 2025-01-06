/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Notifier, NotifierEvent } from "../Notifier";
import DMRoomMap from "../utils/DMRoomMap";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { useSettingValue } from "./useSettings";
import { useEventEmitter, useTypedEventEmitter } from "./useEventEmitter";

export interface UserOnboardingContext {
    hasAvatar: boolean;
    hasDevices: boolean;
    hasDmRooms: boolean;
    showNotificationsPrompt: boolean;
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
    const cli = useMatrixClientContext();

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

function useShowNotificationsPrompt(): boolean {
    const client = useMatrixClientContext();

    const [value, setValue] = useState<boolean>(client.pushRules ? Notifier.shouldShowPrompt() : true);

    const updateValue = useCallback(() => {
        setValue(client.pushRules ? Notifier.shouldShowPrompt() : true);
    }, [client]);

    useEventEmitter(Notifier, NotifierEvent.NotificationHiddenChange, () => {
        updateValue();
    });

    const setting = useSettingValue("notificationsEnabled");
    useEffect(() => {
        updateValue();
    }, [setting, updateValue]);

    // shouldShowPrompt is dependent on the client having push rules. There isn't an event for the client
    // fetching its push rules, but we'll know it has them by the time it sync, so we update this on sync.
    useTypedEventEmitter(client, ClientEvent.Sync, updateValue);

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
    const showNotificationsPrompt = useShowNotificationsPrompt();

    return useMemo(
        () => ({ hasAvatar, hasDevices, hasDmRooms, showNotificationsPrompt }),
        [hasAvatar, hasDevices, hasDmRooms, showNotificationsPrompt],
    );
}
