/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { ElementHandle } from "puppeteer";

import { openRoomSummaryCard } from "./rightpanel";
import { ElementSession } from "../session";

export async function openMemberInfo(session: ElementSession, name: String): Promise<void> {
    const membersAndNames = await getMembersInMemberlist(session);
    const matchingLabel = membersAndNames.filter((m) => {
        return m.displayName === name;
    }).map((m) => m.label)[0];
    await matchingLabel.click();
}

interface MemberName {
    label: ElementHandle;
    displayName: string;
}

export async function getMembersInMemberlist(session: ElementSession): Promise<MemberName[]> {
    await openRoomSummaryCard(session);
    const memberPanelButton = await session.query(".mx_RoomSummaryCard_icon_people");
    // We are back at the room summary card
    await memberPanelButton.click();

    const memberNameElements = await session.queryAll(".mx_MemberList .mx_EntityTile_name");
    return Promise.all(memberNameElements.map(async (el) => {
        return { label: el, displayName: await session.innerText(el) };
    }));
}
