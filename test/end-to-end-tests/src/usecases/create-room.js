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
    const roomDirectoryButton = await session.query('.mx_LeftPanel_explore .mx_AccessibleButton');
    await roomDirectoryButton.click();
}

async function createRoom(session, roomName) {
    session.log.step(`creates room "${roomName}"`);

    const roomListHeaders = await session.queryAll('.mx_RoomSubList_labelContainer');
    const roomListHeaderLabels = await Promise.all(roomListHeaders.map(h => session.innerText(h)));
    const roomsIndex = roomListHeaderLabels.findIndex(l => l.toLowerCase().includes("rooms"));
    if (roomsIndex === -1) {
        throw new Error("could not find room list section that contains rooms in header");
    }
    const roomsHeader = roomListHeaders[roomsIndex];
    const addRoomButton = await roomsHeader.$(".mx_RoomSubList_addRoom");
    await addRoomButton.click();


    const roomNameInput = await session.query('.mx_CreateRoomDialog_name input');
    await session.replaceInputText(roomNameInput, roomName);

    const createButton = await session.query('.mx_Dialog_primary');
    await createButton.click();

    await session.query('.mx_MessageComposer');
    session.log.done();
}

module.exports = {openRoomDirectory, createRoom};
