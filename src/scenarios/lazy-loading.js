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
const changeRoomSettings = require('../usecases/room-settings');
const {enableLazyLoading} = require('../usecases/settings');

module.exports = async function lazyLoadingScenarios(alice, bob, charlies) {
    console.log(" creating a room for lazy loading member scenarios:");
    await enableLazyLoading(alice);
    const room = "Lazy Loading Test";
    const alias = "#lltest:localhost";
    const charlyMsg1 = "hi bob!";
    const charlyMsg2 = "how's it going??";
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
