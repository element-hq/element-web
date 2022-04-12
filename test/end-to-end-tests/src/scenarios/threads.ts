/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import {
    assertTimelineThreadSummary,
    clickTimelineThreadSummary,
    editThreadMessage,
    reactThreadMessage,
    redactThreadMessage,
    sendThreadMessage,
    startThread,
} from "../usecases/threads";
import { sendMessage } from "../usecases/send-message";
import {
    assertThreadListHasUnreadIndicator,
    clickLatestThreadInThreadListPanel,
    closeRoomRightPanel,
    openThreadListPanel,
} from "../usecases/rightpanel";

export async function threadsScenarios(alice: ElementSession, bob: ElementSession): Promise<void> {
    console.log(" threads tests:");

    // Alice sends message
    await sendMessage(alice, "Hey bob, what do you think about X?");

    // Bob responds via a thread
    await startThread(bob, "I think its Y!");

    // Alice sees thread summary and opens thread panel
    await assertTimelineThreadSummary(alice, "bob", "I think its Y!");
    await assertTimelineThreadSummary(bob, "bob", "I think its Y!");
    await clickTimelineThreadSummary(alice);

    // Bob closes right panel
    await closeRoomRightPanel(bob);

    // Alice responds in thread
    await sendThreadMessage(alice, "Great!");
    await assertTimelineThreadSummary(alice, "alice", "Great!");
    await assertTimelineThreadSummary(bob, "alice", "Great!");

    // Alice reacts to Bob's message instead
    await reactThreadMessage(alice, "😁");
    await assertTimelineThreadSummary(alice, "alice", "Great!");
    await assertTimelineThreadSummary(bob, "alice", "Great!");
    await redactThreadMessage(alice);
    await assertTimelineThreadSummary(alice, "bob", "I think its Y!");
    await assertTimelineThreadSummary(bob, "bob", "I think its Y!");

    // Bob sees notification dot on the thread header icon
    await assertThreadListHasUnreadIndicator(bob);

    // Bob opens thread list and inspects it
    await openThreadListPanel(bob);

    // Bob opens thread in right panel via thread list
    await clickLatestThreadInThreadListPanel(bob);

    // Bob responds to thread
    await sendThreadMessage(bob, "Testing threads s'more :)");
    await assertTimelineThreadSummary(alice, "bob", "Testing threads s'more :)");
    await assertTimelineThreadSummary(bob, "bob", "Testing threads s'more :)");

    // Bob edits thread response
    await editThreadMessage(bob, "Testing threads some more :)");
    await assertTimelineThreadSummary(alice, "bob", "Testing threads some more :)");
    await assertTimelineThreadSummary(bob, "bob", "Testing threads some more :)");
}
