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
const {openRoomDirectory} = require('./create-room');

module.exports = async function join(session, roomName) {
    session.log.step(`joins room "${roomName}"`);
    await openRoomDirectory(session);
    const roomInput = await session.query('.mx_DirectorySearchBox input');
    await session.replaceInputText(roomInput, roomName);

    const firstRoomLabel = await session.query('.mx_RoomDirectory_table .mx_RoomDirectory_name:first-child');
    await firstRoomLabel.click();

    const joinLink = await session.query('.mx_RoomPreviewBar_ViewingRoom .mx_AccessibleButton_kind_primary');
    await joinLink.click();

    await session.query('.mx_MessageComposer');
    session.log.done();
}
