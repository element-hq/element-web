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

module.exports = async function invite(session, userId) {
    session.log.step(`invites "${userId}" to room`);
    await session.delay(200);
    const inviteButton = await session.waitAndQuery(".mx_RightPanel_invite");
    await inviteButton.click();
    const inviteTextArea = await session.waitAndQuery(".mx_ChatInviteDialog textarea");
    await inviteTextArea.type(userId);
    await inviteTextArea.press("Enter");
    const confirmButton = await session.query(".mx_Dialog_primary");
    await confirmButton.click();
    session.log.done();
}