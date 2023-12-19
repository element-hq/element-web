/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
