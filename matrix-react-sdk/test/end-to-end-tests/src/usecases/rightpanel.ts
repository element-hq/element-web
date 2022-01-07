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

import { ElementSession } from "../session";

export async function openRoomRightPanel(session: ElementSession): Promise<void> {
    try {
        await session.query('.mx_RoomHeader .mx_RightPanel_headerButton_highlight[aria-label="Room Info"]');
    } catch (e) {
        // If the room summary is not yet open, open it
        const roomSummaryButton = await session.query('.mx_RoomHeader .mx_AccessibleButton[aria-label="Room Info"]');
        await roomSummaryButton.click();
    }
}

export async function goBackToRoomSummaryCard(session: ElementSession): Promise<void> {
    for (let i = 0; i < 5; i++) {
        try {
            const backButton = await session.query(".mx_BaseCard_back", 500);
            // Right panel is open to the wrong thing - go back up to the Room Summary Card
            // Sometimes our tests have this opened to MemberInfo
            await backButton.click();
        } catch (e) {
            // explicitly check for TimeoutError as this sometimes returned
            // `Error: Node is detached from document` due to a re-render race or similar
            if (e.name === "TimeoutError") {
                break; // stop trying to go further back
            }
        }
    }
}

export async function openRoomSummaryCard(session: ElementSession) {
    await openRoomRightPanel(session);
    await goBackToRoomSummaryCard(session);
}
