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

module.exports.verifyDeviceForUser = async function(session, name, expectedDevice) {
    session.log.step(`verifies e2e device for ${name}`);
    const membersAndNames = await getMembersInMemberlist(session);
    const matchingLabel = membersAndNames.filter((m) => {
        return m.displayName === name;
    }).map((m) => m.label)[0];
    await matchingLabel.click();
    const firstVerifyButton = await session.waitAndQuery(".mx_MemberDeviceInfo_verify");
    await firstVerifyButton.click();
    const dialogCodeFields = await session.waitAndQueryAll(".mx_QuestionDialog code");
    assert.equal(dialogCodeFields.length, 2);
    const deviceId = await session.innerText(dialogCodeFields[0]);
    const deviceKey = await session.innerText(dialogCodeFields[1]);
    assert.equal(expectedDevice.id, deviceId);
    assert.equal(expectedDevice.key, deviceKey);
    const confirmButton = await session.query(".mx_Dialog_primary");
    await confirmButton.click();
    const closeMemberInfo = await session.query(".mx_MemberInfo_cancel");
    await closeMemberInfo.click();
    session.log.done();
}

async function getMembersInMemberlist(session) {
    const memberNameElements = await session.waitAndQueryAll(".mx_MemberList .mx_EntityTile_name");
    return Promise.all(memberNameElements.map(async (el) => {
        return {label: el, displayName: await session.innerText(el)};
    }));
}

module.exports.getMembersInMemberlist = getMembersInMemberlist;
