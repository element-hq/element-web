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

import { findSublist } from "./create-room";
import { ElementSession } from "../session";

export async function selectRoom(session: ElementSession, name: string): Promise<void> {
    session.log.step(`select "${name}" room`);
    const inviteSublist = await findSublist(session, "rooms");
    const invitesHandles = await inviteSublist.$$(".mx_RoomTile_title");
    const invitesWithText = await Promise.all(invitesHandles.map(async (roomHandle) => {
        const text = await session.innerText(roomHandle);
        return { roomHandle, text };
    }));
    const roomHandle = invitesWithText.find(({ roomHandle, text }) => {
        return text.trim() === name;
    }).roomHandle;

    await roomHandle.click();

    session.log.done();
}
