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

import { Frame } from "puppeteer";

import { ElementSession } from "../session";

export async function sendSticker(session: ElementSession): Promise<void> {
    session.log.step(`opens composer menu`);
    const kebabButton = await session.query('.mx_MessageComposer_buttonMenu');
    await kebabButton.click();
    session.log.done();

    let stickerFrame: Frame;

    // look to see if the sticker picker is already there (it's persistent, so
    // it will only load a new frame the first time we open it)
    for (const f of session.page.frames()) {
        if ((await f.title()) === "Fake Sticker Picker") {
            stickerFrame = f;
        }
    }

    const stickerFramePromise = new Promise<Frame>(resolve => {
        session.page.once('frameattached', async f => {
            await f.waitForNavigation();
            resolve(f);
        });
    });

    session.log.step(`opens sticker picker`);

    const stickerOption = await session.query('#stickersButton');
    await stickerOption.click();

    if (stickerFrame === undefined) {
        stickerFrame = await stickerFramePromise;
    }

    if (stickerFrame === undefined) throw new Error("Couldn't find sticker picker frame");
    session.log.done();

    session.log.step(`clicks sticker button`);

    const sendStickerButton = await stickerFrame.waitForSelector('#sendsticker');
    sendStickerButton.click();

    // wait for the message to appear sent
    await session.query(".mx_EventTile_last:not(.mx_EventTile_sending)");

    const stickerSrc = await session.page.evaluate(() => {
        return document.querySelector(
            '.mx_EventTile_last .mx_MStickerBody_wrapper img',
        ).getAttribute('src');
    });

    if (!stickerSrc.split('?')[0].endsWith('/_matrix/media/r0/thumbnail/somewhere')) {
        throw new Error("Unexpected image src for sticker: got " + stickerSrc);
    }

    const stickerAlt = await session.page.evaluate(() => {
        return document.querySelector(
            '.mx_EventTile_last .mx_MStickerBody_wrapper img',
        ).getAttribute('alt');
    });

    if (stickerAlt !== "Test Sticker") {
        throw new Error("Unexpected image alt for sticker: got " + stickerAlt);
    }

    session.log.done();
}
