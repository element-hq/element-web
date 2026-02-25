/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator, Page } from "@playwright/test";

export class Timeline {
    constructor(private page: Page) {}

    // Scroll to the top of the timeline
    async scrollToTop(): Promise<void> {
        const locator = this.page.locator(".mx_RoomView_timeline .mx_ScrollPanel");
        await locator.evaluate((node) => {
            while (node.scrollTop > 0) {
                node.scrollTo(0, 0);
            }
        });
    }

    public async scrollToBottom(): Promise<void> {
        await this.page
            .locator(".mx_ScrollPanel")
            .evaluate((scrollPanel) => scrollPanel.scrollTo(0, scrollPanel.scrollHeight));
    }

    // Find the event tile matching the given sender & body
    async findEventTile(sender: string, body: string): Promise<Locator> {
        const locators = await this.page.locator(".mx_RoomView_MessageList .mx_EventTile").all();
        let latestSender: string;
        for (const locator of locators) {
            const displayName = locator.locator(".mx_DisambiguatedProfile_displayName");
            if (await displayName.count()) {
                latestSender = await displayName.innerText();
            }
            if (latestSender === sender && (await locator.locator(".mx_EventTile_body").innerText()) === body) {
                return locator;
            }
        }
    }
}
