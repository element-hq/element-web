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

const assert = require('assert');

async function openSettings(session, section) {
    const menuButton = await session.query(".mx_TopLeftMenuButton_name");
    await menuButton.click();
    const settingsItem = await session.query(".mx_TopLeftMenu_icon_settings");
    await settingsItem.click();
    if (section) {
        const sectionButton = await session.query(
            `.mx_UserSettingsDialog .mx_TabbedView_tabLabels .mx_UserSettingsDialog_${section}Icon`);
        await sectionButton.click();
    }
}

module.exports.enableLazyLoading = async function(session) {
    session.log.step(`enables lazy loading of members in the lab settings`);
    const settingsButton = await session.query('.mx_BottomLeftMenu_settings');
    await settingsButton.click();
    const llCheckbox = await session.query("#feature_lazyloading");
    await llCheckbox.click();
    await session.waitForReload();
    const closeButton = await session.query(".mx_RoomHeader_cancelButton");
    await closeButton.click();
    session.log.done();
};

module.exports.getE2EDeviceFromSettings = async function(session) {
    session.log.step(`gets e2e device/key from settings`);
    await openSettings(session, "security");
    const deviceAndKey = await session.queryAll(".mx_SettingsTab_section .mx_SecurityUserSettingsTab_deviceInfo code");
    assert.equal(deviceAndKey.length, 2);
    const id = await (await deviceAndKey[0].getProperty("innerText")).jsonValue();
    const key = await (await deviceAndKey[1].getProperty("innerText")).jsonValue();
    const closeButton = await session.query(".mx_UserSettingsDialog .mx_Dialog_cancelButton");
    await closeButton.click();
    session.log.done();
    return {id, key};
};
