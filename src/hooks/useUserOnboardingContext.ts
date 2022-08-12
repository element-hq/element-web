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
import { ClientEvent, IMyDevice, Room } from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";
import DMRoomMap from "../utils/DMRoomMap";
import { useEventEmitter } from "./useEventEmitter";

export interface UserOnboardingContext {
    avatar: string | null;
    myDevice: string;
    devices: IMyDevice[];
    dmRooms: {[userId: string]: Room};
}

export function useUserOnboardingContext(): UserOnboardingContext | null {
    const [context, setContext] = useState<UserOnboardingContext | null>(null);

    const cli = MatrixClientPeg.get();
    const handler = useCallback(async () => {
        try {
            const profile = await cli.getProfileInfo(cli.getUserId());

            const myDevice = cli.getDeviceId();
            const devices = await cli.getDevices();

            const dmRooms = DMRoomMap.shared().getUniqueRoomsWithIndividuals() ?? {};
            setContext({
                avatar: profile?.avatar_url ?? null,
                myDevice,
                devices: devices.devices,
                dmRooms: dmRooms,
            });
        } catch (e) {
            logger.warn("Could not load context for user onboarding task list: ", e);
            setContext(null);
        }
    }, [cli]);

    useEventEmitter(cli, ClientEvent.AccountData, handler);
    useEffect(() => {
        const handle = setInterval(handler, 2000);
        handler();
        return () => {
            if (handle) {
                clearInterval(handle);
            }
        };
    }, [handler]);

    return context;
}
