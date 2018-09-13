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
const join = require('../usecases/join');
const sendMessage = require('../usecases/send-message');
const {
    checkTimelineContains,
    scrollToTimelineTop
} = require('../usecases/timeline');
const createRoom = require('../usecases/create-room');
const {getMembersInMemberlist} = require('../usecases/memberlist');
const changeRoomSettings = require('../usecases/room-settings');
const {enableLazyLoading} = require('../usecases/settings');
const assert = require('assert');

module.exports = async function lazyLoadingScenarios(alice, bob, charlies) {
    console.log(" creating a room for lazy loading member scenarios:");
    await enableLazyLoading(alice);
    await setupRoomWithBobAliceAndCharlies(alice, bob, charlies);
    await checkPaginatedDisplayNames(alice, charlies);
    await checkMemberList(alice, charlies);
}

const room = "Lazy Loading Test";
const alias = "#lltest:localhost";
const charlyMsg1 = "hi bob!";
const charlyMsg2 = "how's it going??";

async function setupRoomWithBobAliceAndCharlies(alice, bob, charlies) {
    await createRoom(bob, room);
    await changeRoomSettings(bob, {directory: true, visibility: "public_no_guests", alias});
    // wait for alias to be set by server after clicking "save"
    // so the charlies can join it.
    await bob.delay(500);
    const charlyMembers = await charlies.join(alias);
    await charlyMembers.talk(charlyMsg1);
    await charlyMembers.talk(charlyMsg2);
    bob.log.step("sends 20 messages").mute();
    for(let i = 20; i >= 1; --i) {
        await sendMessage(bob, `I will only say this ${i} time(s)!`);
    }
    bob.log.unmute().done();
    await join(alice, alias);
}

async function checkPaginatedDisplayNames(alice, charlies) {
    await scrollToTimelineTop(alice);
    //alice should see 2 messages from every charly with
    //the correct display name
    const expectedMessages = [charlyMsg1, charlyMsg2].reduce((messages, msgText) => {
        return charlies.sessions.reduce((messages, charly) => {
            return messages.concat({
                sender: charly.displayName(),
                body: msgText,
            });
        }, messages);
    }, []);
    await checkTimelineContains(alice, expectedMessages, "Charly #1-10");
}

async function checkMemberList(alice, charlies) {
    alice.log.step("checks the memberlist contains herself, bob and all charlies");
    const displayNames = (await getMembersInMemberlist(alice)).map((m) => m.displayName);
    assert(displayNames.includes("alice"));
    assert(displayNames.includes("bob"));
    charlies.sessions.forEach((charly) => {
        assert(displayNames.includes(charly.displayName()),
            `${charly.displayName()} should be in the member list, ` +
            `only have ${displayNames}`);
    });
    alice.log.done();
}
