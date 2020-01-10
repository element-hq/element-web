/*
Copyright 2019 New Vector Ltd
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

const assert = require('assert');
const {openMemberInfo} = require("./memberlist");
const {assertDialog, acceptDialog} = require("./dialog");

async function assertVerified(session) {
    const dialogSubTitle = await session.innerText(await session.query(".mx_Dialog h2"));
    assert(dialogSubTitle, "Verified!");
}

async function startVerification(session, name) {
    await openMemberInfo(session, name);
    // click verify in member info
    const firstVerifyButton = await session.query(".mx_MemberDeviceInfo_verify");
    await firstVerifyButton.click();
}

async function getSasCodes(session) {
    const sasLabelElements = await session.queryAll(
        ".mx_VerificationShowSas .mx_VerificationShowSas_emojiSas .mx_VerificationShowSas_emojiSas_label");
    const sasLabels = await Promise.all(sasLabelElements.map(e => session.innerText(e)));
    return sasLabels;
}

module.exports.startSasVerifcation = async function(session, name) {
    await startVerification(session, name);
    // expect "Verify device" dialog and click "Begin Verification"
    await assertDialog(session, "Verify device");
    // click "Begin Verification"
    await acceptDialog(session);
    const sasCodes = await getSasCodes(session);
    // click "Verify"
    await acceptDialog(session);
    await assertVerified(session);
    // click "Got it" when verification is done
    await acceptDialog(session);
    return sasCodes;
};

module.exports.acceptSasVerification = async function(session, name) {
    await assertDialog(session, "Incoming Verification Request");
    const opponentLabelElement = await session.query(".mx_IncomingSasDialog_opponentProfile h2");
    const opponentLabel = await session.innerText(opponentLabelElement);
    assert(opponentLabel, name);
    // click "Continue" button
    await acceptDialog(session);
    const sasCodes = await getSasCodes(session);
    // click "Verify"
    await acceptDialog(session);
    await assertVerified(session);
    // click "Got it" when verification is done
    await acceptDialog(session);
    return sasCodes;
};
