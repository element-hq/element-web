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

async function openRoomDirectory(session) {
    const roomDirectoryButton = await session.query('.mx_LeftPanel_exploreButton');
    await roomDirectoryButton.click();
}

async function findSublist(session, name) {
    const sublists = await session.queryAll('.mx_RoomSublist');
    for (const sublist of sublists) {
        const header = await sublist.$('.mx_RoomSublist_headerText');
        const headerText = await session.innerText(header);
        if (headerText.toLowerCase().includes(name.toLowerCase())) {
            return sublist;
        }
    }
    throw new Error(`could not find room list section that contains '${name}' in header`);
}

async function createRoom(session, roomName, encrypted=false) {
    session.log.step(`creates room "${roomName}"`);

    const roomsSublist = await findSublist(session, "rooms");
    const addRoomButton = await roomsSublist.$(".mx_RoomSublist_auxButton");
    await addRoomButton.click();

    const roomNameInput = await session.query('.mx_CreateRoomDialog_name input');
    await session.replaceInputText(roomNameInput, roomName);

    if (!encrypted) {
        const encryptionToggle = await session.query('.mx_CreateRoomDialog_e2eSwitch .mx_ToggleSwitch');
        await encryptionToggle.click();
    }

    const createButton = await session.query('.mx_Dialog_primary');
    await createButton.click();

    await session.query('.mx_MessageComposer');
    session.log.done();
}

async function createDm(session, invitees) {
    session.log.step(`creates DM with ${JSON.stringify(invitees)}`);

    const dmsSublist = await findSublist(session, "people");
    const startChatButton = await dmsSublist.$(".mx_RoomSublist_auxButton");
    await startChatButton.click();

    const inviteesEditor = await session.query('.mx_InviteDialog_editor textarea');
    for (const target of invitees) {
        await session.replaceInputText(inviteesEditor, target);
        await session.delay(1000); // give it a moment to figure out a suggestion
        // find the suggestion and accept it
        const suggestions = await session.queryAll('.mx_InviteDialog_roomTile_userId');
        const suggestionTexts = await Promise.all(suggestions.map(s => session.innerText(s)));
        const suggestionIndex = suggestionTexts.indexOf(target);
        if (suggestionIndex === -1) {
            throw new Error(`failed to find a suggestion in the DM dialog to invite ${target} with`);
        }
        await suggestions[suggestionIndex].click();
    }

    // press the go button and hope for the best
    const goButton = await session.query('.mx_InviteDialog_goButton');
    await goButton.click();

    await session.query('.mx_MessageComposer');
    session.log.done();
}

module.exports = {openRoomDirectory, findSublist, createRoom, createDm};
