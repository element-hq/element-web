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

module.exports = async function invite(session, userId) {
    session.log.step(`invites "${userId}" to room`);
    await session.delay(1000);
    const memberPanelButton = await session.query(".mx_RightPanel_membersButton");
    try {
        await session.query(".mx_RightPanel_headerButton_highlight", 500);
        // Right panel is open - toggle it to ensure it's the member list
        // Sometimes our tests have this opened to MemberInfo
        await memberPanelButton.click();
        await memberPanelButton.click();
    } catch (e) {
        // Member list is closed - open it
        await memberPanelButton.click();
    }
    const inviteButton = await session.query(".mx_MemberList_invite");
    await inviteButton.click();
    const inviteTextArea = await session.query(".mx_InviteDialog_editor textarea");
    await inviteTextArea.type(userId);
    const selectUserItem = await session.query(".mx_InviteDialog_roomTile");
    await selectUserItem.click();
    const confirmButton = await session.query(".mx_InviteDialog_goButton");
    await confirmButton.click();
    session.log.done();
};
