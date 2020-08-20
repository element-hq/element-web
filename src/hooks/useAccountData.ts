/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {useCallback, useState} from "react";
import {MatrixClient} from "matrix-js-sdk/src/client";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import {Room} from "matrix-js-sdk/src/models/room";

import {useEventEmitter} from "./useEventEmitter";

const tryGetContent = (ev?: MatrixEvent) => ev ? ev.getContent() : undefined;

// Hook to simplify listening to Matrix account data
export const useAccountData = <T extends {}>(cli: MatrixClient, eventType: string) => {
    const [value, setValue] = useState<T>(() => tryGetContent(cli.getAccountData(eventType)));

    const handler = useCallback((event) => {
        if (event.getType() !== eventType) return;
        setValue(event.getContent());
    }, [eventType]);
    useEventEmitter(cli, "accountData", handler);

    return value || {} as T;
};

// Hook to simplify listening to Matrix room account data
export const useRoomAccountData = <T extends {}>(room: Room, eventType: string) => {
    const [value, setValue] = useState<T>(() => tryGetContent(room.getAccountData(eventType)));

    const handler = useCallback((event) => {
        if (event.getType() !== eventType) return;
        setValue(event.getContent());
    }, [eventType]);
    useEventEmitter(room, "Room.accountData", handler);

    return value || {} as T;
};
