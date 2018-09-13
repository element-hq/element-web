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


const {delay} = require('../util');
const {acceptDialogMaybe} = require('../usecases/dialog');
const join = require('../usecases/join');
const sendMessage = require('../usecases/send-message');
const acceptInvite = require('../usecases/accept-invite');
const invite = require('../usecases/invite');
const {receiveMessage} = require('../usecases/timeline');
const createRoom = require('../usecases/create-room');
const changeRoomSettings = require('../usecases/room-settings');
const {getE2EDeviceFromSettings} = require('../usecases/settings');
const verifyDeviceForUser = require('../usecases/verify-device');

module.exports = async function e2eEncryptionScenarios(alice, bob) {
    console.log(" creating an e2e encrypted room and join through invite:");
    const room = "secrets";
    await createRoom(bob, room);
    await changeRoomSettings(bob, {encryption: true});
    await invite(bob, "@alice:localhost");
    await acceptInvite(alice, room);
    const bobDevice = await getE2EDeviceFromSettings(bob);
    // wait some time for the encryption warning dialog
    // to appear after closing the settings
    await delay(1000);
    await acceptDialogMaybe(bob, "encryption");
    const aliceDevice = await getE2EDeviceFromSettings(alice);
    // wait some time for the encryption warning dialog
    // to appear after closing the settings
    await delay(1000);
    await acceptDialogMaybe(alice, "encryption");
    await verifyDeviceForUser(bob, "alice", aliceDevice);
    await verifyDeviceForUser(alice, "bob", bobDevice);
    const aliceMessage = "Guess what I just heard?!"
    await sendMessage(alice, aliceMessage);
    await receiveMessage(bob, {sender: "alice", body: aliceMessage, encrypted: true});
    const bobMessage = "You've got to tell me!";
    await sendMessage(bob, bobMessage);
    await receiveMessage(alice, {sender: "bob", body: bobMessage, encrypted: true});
}
