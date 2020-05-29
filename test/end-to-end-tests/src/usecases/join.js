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

const {openRoomDirectory} = require('./create-room');

module.exports = async function join(session, roomName) {
    session.log.step(`joins room "${roomName}"`);
    await openRoomDirectory(session);
    const roomInput = await session.query('.mx_DirectorySearchBox input');
    await session.replaceInputText(roomInput, roomName);

    const joinFirstLink = await session.query('.mx_RoomDirectory_table .mx_RoomDirectory_join .mx_AccessibleButton');
    await joinFirstLink.click();
    await session.query('.mx_MessageComposer');
    session.log.done();
};
