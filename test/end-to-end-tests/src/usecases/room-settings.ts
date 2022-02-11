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

import { strict as assert } from 'assert';
import { ElementHandle } from "puppeteer";

import { openRoomSummaryCard } from "./rightpanel";
import { acceptDialog } from './dialog';
import { ElementSession } from "../session";

export async function setSettingsToggle(session: ElementSession, toggle: ElementHandle, enabled): Promise<boolean> {
    const className = await session.getElementProperty(toggle, "className");
    const checked = className.includes("mx_ToggleSwitch_on");
    if (checked !== enabled) {
        await toggle.click();
        session.log.done();
        return true;
    } else {
        session.log.done("already set");
    }
}

export async function checkSettingsToggle(session: ElementSession,
    toggle: ElementHandle, shouldBeEnabled: boolean): Promise<void> {
    const className = await session.getElementProperty(toggle, "className");
    const checked = className.includes("mx_ToggleSwitch_on");
    if (checked === shouldBeEnabled) {
        session.log.done('set as expected');
    } else {
        // other logs in the area should give more context as to what this means.
        throw new Error("settings toggle value didn't match expectation");
    }
}

interface Tabs {
    securityTabButton: ElementHandle;
    generalTabButton: ElementHandle;
}

async function findTabs(session: ElementSession): Promise<Tabs> {
    /// XXX delay is needed here, possibly because the header is being rerendered
    /// click doesn't do anything otherwise
    await session.delay(1000);

    await openRoomSummaryCard(session);

    const settingsButton = await session.query(".mx_RoomSummaryCard_icon_settings");
    await settingsButton.click();

    //find tabs
    const tabButtons = await session.queryAll(".mx_RoomSettingsDialog .mx_TabbedView_tabLabel");
    const tabLabels = await Promise.all(tabButtons.map(t => session.innerText(t)));
    const securityTabButton = tabButtons[tabLabels.findIndex(l => l.toLowerCase().includes("security"))];
    const generalTabButton = tabButtons[tabLabels.findIndex(l => l.toLowerCase().includes("general"))];

    return { securityTabButton, generalTabButton };
}

interface Settings {
    encryption?: boolean;
    directory?: boolean;
    alias?: string;
    publishedAlias?: string;
    visibility?: string;
}

export async function checkRoomSettings(session: ElementSession, expectedSettings: Settings): Promise<void> {
    session.log.startGroup(`checks the room settings`);

    const { securityTabButton } = await findTabs(session);
    const generalSwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const isDirectory = generalSwitches[0];

    if (typeof expectedSettings.directory === 'boolean') {
        session.log.step(`checks directory listing is ${expectedSettings.directory}`);
        await checkSettingsToggle(session, isDirectory, expectedSettings.directory);
    }

    if (expectedSettings.publishedAlias) {
        session.log.step(`checks for published alias of ${expectedSettings.publishedAlias}`);
        const publishedAliases = await session.queryAll('#roomAltAliases .mx_EditableItem_item, #roomAltAliases li');
        const publishedAliasTexts = await Promise.all(publishedAliases.map(a => session.innerText(a)));
        if (publishedAliasTexts.find(a => a.includes(expectedSettings.publishedAlias))) {
            session.log.done("present");
        } else {
            throw new Error(`could not find published alias ${expectedSettings.publishedAlias}`);
        }
    }

    if (expectedSettings.alias) {
        session.log.step(`checks for local alias of ${expectedSettings.alias}`);
        const summary = await session.query(".mx_RoomSettingsDialog .mx_AliasSettings summary");
        await summary.click();
        const localAliases = await session.queryAll('#roomAliases .mx_EditableItem_item, #roomAliases li');
        const localAliasTexts = await Promise.all(localAliases.map(a => session.innerText(a)));
        if (localAliasTexts.find(a => a.includes(expectedSettings.alias))) {
            session.log.done("present");
        } else {
            throw new Error(`could not find local alias ${expectedSettings.alias}`);
        }
    }

    await securityTabButton.click();
    await session.delay(500);
    const securitySwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const e2eEncryptionToggle = securitySwitches[0];

    if (typeof expectedSettings.encryption === "boolean") {
        session.log.step(`checks room e2e encryption is ${expectedSettings.encryption}`);
        await checkSettingsToggle(session, e2eEncryptionToggle, expectedSettings.encryption);
    }

    if (expectedSettings.visibility) {
        session.log.step(`checks visibility is ${expectedSettings.visibility}`);
        const radios = await session.queryAll(".mx_RoomSettingsDialog input[type=radio]");
        // the "Who can read history?" "Anyone" radio option is only shown if visibility is set to public
        assert.equal(radios.length, expectedSettings.visibility === "public" ? 7 : 6);
        const [inviteOnlyRoom, spaceMembers, publicRoom] = radios;

        let expectedRadio = null;
        if (expectedSettings.visibility === "invite_only") {
            expectedRadio = inviteOnlyRoom;
        } else if (expectedSettings.visibility === "space_members") {
            expectedRadio = spaceMembers;
        } else if (expectedSettings.visibility === "public") {
            expectedRadio = publicRoom;
        } else {
            throw new Error(`unrecognized room visibility setting: ${expectedSettings.visibility}`);
        }
        if (await session.isChecked(expectedRadio)) {
            session.log.done();
        } else {
            throw new Error("room visibility is not as expected");
        }
    }

    const closeButton = await session.query(".mx_RoomSettingsDialog .mx_Dialog_cancelButton");
    await closeButton.click();

    session.log.endGroup();
}

async function getValidationError(session: ElementSession): Promise<string | undefined> {
    try {
        const validationDetail = await session.query(".mx_Validation_detail");
        return session.innerText(validationDetail);
    } catch (e) {
        // no validation tooltips
        return undefined;
    }
}

export async function changeRoomSettings(session: ElementSession, settings: Settings) {
    session.log.startGroup(`changes the room settings`);

    const { securityTabButton, generalTabButton } = await findTabs(session);

    securityTabButton.click();
    await session.delay(500);
    const securitySwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const e2eEncryptionToggle = securitySwitches[0];

    if (typeof settings.encryption === "boolean") {
        session.log.step(`sets room e2e encryption to ${settings.encryption}`);
        const clicked = await setSettingsToggle(session, e2eEncryptionToggle, settings.encryption);
        // if enabling, accept beta warning dialog
        if (clicked && settings.encryption) {
            await acceptDialog(session, "Enable encryption?");
        }
    }

    if (settings.visibility) {
        session.log.step(`sets visibility to ${settings.visibility}`);
        const radios = await session.queryAll(".mx_RoomSettingsDialog label");
        assert.equal(radios.length, 7);
        const [inviteOnlyRoom,, publicRoom] = radios;

        if (settings.visibility === "invite_only") {
            await inviteOnlyRoom.click();
        } else if (settings.visibility === "public") {
            await publicRoom.click();
        } else {
            throw new Error(`unrecognized room visibility setting: ${settings.visibility}`);
        }
        await session.delay(100);
        session.log.done();
    }

    generalTabButton.click();
    await session.delay(500);
    const generalSwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const isDirectory = generalSwitches[0];

    if (typeof settings.directory === "boolean") {
        session.log.step(`sets directory listing to ${settings.directory}`);
        await setSettingsToggle(session, isDirectory, settings.directory);
    }

    if (settings.alias) {
        session.log.step(`adding local alias ${settings.alias}`);
        const aliasField = await session.query("#roomAliases input[type=text]");
        await session.replaceInputText(aliasField, settings.alias.substring(1, settings.alias.lastIndexOf(":")));
        const addButton = await session.query("#roomAliases .mx_AccessibleButton");
        await addButton.click();
        await session.query("#roomAliases .mx_Field_valid, #roomAliases .mx_Field_invalid"); // await validator
        assert.equal(await getValidationError(session), undefined);
        session.log.done();
    }

    if (settings.publishedAlias) {
        session.log.step(`adding published alias ${settings.alias}`);
        const aliasField = await session.query("#roomAltAliases input[type=text]");
        await session.replaceInputText(aliasField, settings.alias.substring(1));
        const addButton = await session.query("#roomAltAliases .mx_AccessibleButton");
        await addButton.click();
        await session.query("#roomAltAliases .mx_Field_valid, #roomAltAliases .mx_Field_invalid"); // await validator
        assert.equal(await getValidationError(session), undefined);
        session.log.done();
    }

    const closeButton = await session.query(".mx_RoomSettingsDialog .mx_Dialog_cancelButton");
    await closeButton.click();

    session.log.endGroup();
}
