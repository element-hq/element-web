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

import { strict as assert } from "assert";

import { ElementSession } from "../session";

export async function enableThreads(session: ElementSession): Promise<void> {
    session.log.step(`enables threads`);
    await session.page.evaluate(() => {
        window.localStorage.setItem("mx_seen_feature_thread_experimental", "1"); // inhibit dialog
        window["mxSettingsStore"].setValue("feature_thread", null, "device", true);
    });
    session.log.done();
}

async function clickReplyInThread(session: ElementSession): Promise<void> {
    const events = await session.queryAll(".mx_EventTile_line");
    const event = events[events.length - 1];
    await event.hover();
    const button = await event.$(".mx_MessageActionBar_threadButton");
    await button.click();
}

export async function sendThreadMessage(session: ElementSession, message: string): Promise<void> {
    session.log.step(`sends thread response "${message}"`);
    const composer = await session.query(".mx_ThreadView .mx_BasicMessageComposer_input");
    await composer.click();
    await composer.type(message);

    const text = await session.innerText(composer);
    assert.equal(text.trim(), message.trim());
    await composer.press("Enter");
    // wait for the message to appear sent
    await session.query(".mx_ThreadView .mx_EventTile_last:not(.mx_EventTile_sending)");
    session.log.done();
}

export async function editThreadMessage(session: ElementSession, message: string): Promise<void> {
    session.log.step(`edits thread response "${message}"`);
    const events = await session.queryAll(".mx_EventTile_line");
    const event = events[events.length - 1];
    await event.hover();
    const button = await event.$(".mx_MessageActionBar_editButton");
    await button.click();

    const composer = await session.query(".mx_ThreadView .mx_EditMessageComposer .mx_BasicMessageComposer_input");
    await composer.click({ clickCount: 3 });
    await composer.type(message);

    const text = await session.innerText(composer);
    assert.equal(text.trim(), message.trim());
    await composer.press("Enter");
    // wait for the edit to appear sent
    await session.query(".mx_ThreadView .mx_EventTile_last:not(.mx_EventTile_sending)");
    session.log.done();
}

export async function redactThreadMessage(session: ElementSession): Promise<void> {
    session.log.startGroup(`redacts latest thread response`);

    const events = await session.queryAll(".mx_ThreadView .mx_EventTile_line");
    const event = events[events.length - 1];
    await event.hover();

    session.log.step(`clicks the ... button`);
    let button = await event.$('.mx_MessageActionBar [aria-label="Options"]');
    await button.click();
    session.log.done();

    session.log.step(`clicks the remove option`);
    button = await session.query('.mx_IconizedContextMenu_item[aria-label="Remove"]');
    await button.click();
    session.log.done();

    session.log.step(`confirms in the dialog`);
    button = await session.query(".mx_Dialog_primary");
    await button.click();
    session.log.done();

    await session.query(".mx_ThreadView .mx_RedactedBody");
    await session.delay(1000); // give the app a chance to settle

    session.log.endGroup();
}

export async function reactThreadMessage(session: ElementSession, reaction: string): Promise<void> {
    session.log.startGroup(`reacts to latest thread response`);

    const events = await session.queryAll(".mx_ThreadView .mx_EventTile_line");
    const event = events[events.length - 1];
    await event.hover();

    session.log.step(`clicks the reaction button`);
    let button = await event.$('.mx_MessageActionBar [aria-label="React"]');
    await button.click();
    session.log.done();

    session.log.step(`selects reaction`);
    button = await session.query(`.mx_EmojiPicker_item_wrapper[aria-label=${reaction}]`);
    await button.click;
    session.log.done();

    session.log.step(`clicks away`);
    button = await session.query(".mx_ContextualMenu_background");
    await button.click();
    session.log.done();

    session.log.endGroup();
}

export async function startThread(session: ElementSession, response: string): Promise<void> {
    session.log.startGroup(`creates thread on latest message`);

    await clickReplyInThread(session);
    await sendThreadMessage(session, response);

    session.log.endGroup();
}

export async function assertTimelineThreadSummary(
    session: ElementSession,
    sender: string,
    content: string,
): Promise<void> {
    session.log.step("asserts the timeline thread summary is as expected");
    const summaries = await session.queryAll(".mx_MainSplit_timeline .mx_ThreadSummary");
    const summary = summaries[summaries.length - 1];
    assert.equal(await session.innerText(await summary.$(".mx_ThreadSummary_sender")), sender);
    assert.equal(await session.innerText(await summary.$(".mx_ThreadSummary_content")), content);
    session.log.done();
}

export async function clickTimelineThreadSummary(session: ElementSession): Promise<void> {
    session.log.step(`clicks the latest thread summary in the timeline`);

    const summaries = await session.queryAll(".mx_MainSplit_timeline .mx_ThreadSummary");
    await summaries[summaries.length - 1].click();

    session.log.done();
}
