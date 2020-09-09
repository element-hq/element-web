/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

async function startVerification(session, name) {
    session.log.step("opens their opponent's profile and starts verification");
    await openMemberInfo(session, name);
    // click verify in member info
    const firstVerifyButton = await session.query(".mx_UserInfo_verifyButton");
    await firstVerifyButton.click();

    // wait for the animation to finish
    await session.delay(1000);

    // click 'start verification'
    const startVerifyButton = await session.query('.mx_UserInfo_container .mx_AccessibleButton_kind_primary');
    await startVerifyButton.click();
    session.log.done();
}

async function getSasCodes(session) {
    const sasLabelElements = await session.queryAll(
        ".mx_VerificationShowSas .mx_VerificationShowSas_emojiSas .mx_VerificationShowSas_emojiSas_label");
    const sasLabels = await Promise.all(sasLabelElements.map(e => session.innerText(e)));
    return sasLabels;
}

async function doSasVerification(session) {
    session.log.step("hunts for the emoji to yell at their opponent");
    const sasCodes = await getSasCodes(session);
    session.log.done(sasCodes);

    // Assume they match
    session.log.step("assumes the emoji match");
    const matchButton = await session.query(".mx_VerificationShowSas .mx_AccessibleButton_kind_primary");
    await matchButton.click();
    session.log.done();

    // Wait for a big green shield (universal sign that it worked)
    session.log.step("waits for a green shield");
    await session.query(".mx_VerificationPanel_verified_section .mx_E2EIcon_verified");
    session.log.done();

    // Click 'Got It'
    session.log.step("confirms the green shield");
    const doneButton = await session.query(".mx_VerificationPanel_verified_section .mx_AccessibleButton_kind_primary");
    await doneButton.click();
    session.log.done();

    // Wait a bit for the animation
    session.log.step("confirms their opponent has a green shield");
    await session.delay(1000);

    // Verify that we now have a green shield in their name (proving it still works)
    await session.query('.mx_UserInfo_profile .mx_E2EIcon_verified');
    session.log.done();

    return sasCodes;
}

module.exports.startSasVerifcation = async function(session, name) {
    session.log.startGroup("starts verification");
    await startVerification(session, name);

    // expect to be waiting (the presence of a spinner is a good thing)
    await session.query('.mx_UserInfo_container .mx_EncryptionInfo_spinner');

    const sasCodes = await doSasVerification(session);
    session.log.endGroup();
    return sasCodes;
};

module.exports.acceptSasVerification = async function(session, name) {
    session.log.startGroup("accepts verification");
    const requestToast = await session.query('.mx_Toast_icon_verification');

    // verify the toast is for verification
    const toastHeader = await requestToast.$("h2");
    const toastHeaderText = await session.innerText(toastHeader);
    assert.equal(toastHeaderText, 'Verification Request');
    const toastDescription = await requestToast.$(".mx_Toast_description");
    const toastDescText = await session.innerText(toastDescription);
    assert.equal(toastDescText.startsWith(name), true,
        `verification opponent mismatch: expected to start with '${name}', got '${toastDescText}'`);

    // accept the verification
    const acceptButton = await requestToast.$(".mx_AccessibleButton_kind_primary");
    await acceptButton.click();

    // find the emoji button
    const startEmojiButton = await session.query(".mx_VerificationPanel_verifyByEmojiButton");
    await startEmojiButton.click();

    const sasCodes = await doSasVerification(session);
    session.log.endGroup();
    return sasCodes;
};
