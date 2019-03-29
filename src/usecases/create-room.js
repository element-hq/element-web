/*
Copyright 2018 New Vector Ltd

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

const assert = require('assert');

module.exports = async function createRoom(session, roomName) {
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
    const createRoomButton = await session.waitAndQuery('.mx_RoomDirectory_createRoom');
    await createRoomButton.click();

    const roomNameInput = await session.waitAndQuery('.mx_CreateRoomDialog_input');
    await session.replaceInputText(roomNameInput, roomName);

    const createButton = await session.waitAndQuery('.mx_Dialog_primary');
    await createButton.click();

    await session.waitAndQuery('.mx_MessageComposer');
    session.log.done();
}
