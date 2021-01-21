/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { ensureDMExists, findDMForUser } from './createRoom';
import { MatrixClientPeg } from "./MatrixClientPeg";
import DMRoomMap from "./utils/DMRoomMap";
import SdkConfig from "./SdkConfig";

// Functions for mapping users & rooms for the voip_mxid_translate_pattern
// config option

export function voipUserMapperEnabled(): boolean {
    return SdkConfig.get()['voip_mxid_translate_pattern'] !== undefined;
}

// only exported for tests
export function userToVirtualUser(userId: string, templateString?: string): string {
    if (templateString === undefined) templateString = SdkConfig.get()['voip_mxid_translate_pattern'];
    if (!templateString) return null;
    return templateString.replace('${mxid}', encodeURIComponent(userId).replace(/%/g, '=').toLowerCase());
}

// only exported for tests
export function virtualUserToUser(userId: string, templateString?: string): string {
    if (templateString === undefined) templateString = SdkConfig.get()['voip_mxid_translate_pattern'];
    if (!templateString) return null;

    const regexString = templateString.replace('${mxid}', '(.+)');

    const match = userId.match('^' + regexString + '$');
    if (!match) return null;

    return decodeURIComponent(match[1].replace(/=/g, '%'));
}

async function getOrCreateVirtualRoomForUser(userId: string):Promise<string> {
    const virtualUser = userToVirtualUser(userId);
    if (!virtualUser) return null;

    return await ensureDMExists(MatrixClientPeg.get(), virtualUser);
}

export async function getOrCreateVirtualRoomForRoom(roomId: string):Promise<string> {
    const user = DMRoomMap.shared().getUserIdForRoomId(roomId);
    if (!user) return null;
    return getOrCreateVirtualRoomForUser(user);
}

export function roomForVirtualRoom(roomId: string):string {
    const virtualUser = DMRoomMap.shared().getUserIdForRoomId(roomId);
    if (!virtualUser) return null;
    const realUser = virtualUserToUser(virtualUser);
    const room = findDMForUser(MatrixClientPeg.get(), realUser);
    if (room) {
        return room.roomId;
    } else {
        return null;
    }
}

export function isVirtualRoom(roomId: string):boolean {
    const virtualUser = DMRoomMap.shared().getUserIdForRoomId(roomId);
    if (!virtualUser) return null;
    const realUser = virtualUserToUser(virtualUser);
    return Boolean(realUser);
}
