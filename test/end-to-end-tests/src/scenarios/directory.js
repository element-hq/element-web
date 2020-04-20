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


const join = require('../usecases/join');
const sendMessage = require('../usecases/send-message');
const {receiveMessage} = require('../usecases/timeline');
const {createRoom} = require('../usecases/create-room');
const {changeRoomSettings} = require('../usecases/room-settings');

module.exports = async function roomDirectoryScenarios(alice, bob) {
    console.log(" creating a public room and join through directory:");
    const room = 'test';
    await createRoom(alice, room);
    await changeRoomSettings(alice, {directory: true, visibility: "public_no_guests", alias: "#test"});
    await join(bob, room); //looks up room in directory
    const bobMessage = "hi Alice!";
    await sendMessage(bob, bobMessage);
    await receiveMessage(alice, {sender: "bob", body: bobMessage});
    const aliceMessage = "hi Bob, welcome!";
    await sendMessage(alice, aliceMessage);
    await receiveMessage(bob, {sender: "alice", body: aliceMessage});
};
