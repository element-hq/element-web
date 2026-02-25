/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator, Page } from "@playwright/test";
import { CommandOrControl } from "../e2e/utils";

export enum Filter {
    People = "people",
    PublicRooms = "public_rooms",
}

export class Spotlight {
    private root: Locator;

    constructor(private page: Page) {}

    public async open() {
        this.root = this.page.locator('[role=dialog][aria-label="Search Dialog"]');
        const isSpotlightAlreadyOpen = !!(await this.root.count());
        if (isSpotlightAlreadyOpen) {
            // Close dialog if it is already open
            await this.page.keyboard.press(`${CommandOrControl}+KeyK`);
        }
        await this.page.keyboard.press(`${CommandOrControl}+KeyK`);
    }

    public async filter(filter: Filter) {
        let selector: string;
        switch (filter) {
            case Filter.People:
                selector = "#mx_SpotlightDialog_button_startChat";
                break;
            case Filter.PublicRooms:
                selector = "#mx_SpotlightDialog_button_explorePublicRooms";
                break;
            default:
                selector = ".mx_SpotlightDialog_filter";
                break;
        }
        await this.root.locator(selector).click();
    }

    public async search(query: string) {
        await this.searchBox.getByRole("textbox", { name: "Search" }).fill(query);
    }

    public get searchBox() {
        return this.root.locator(".mx_SpotlightDialog_searchBox");
    }

    public get results() {
        return this.root.locator(".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option");
    }

    public get dialog() {
        return this.root;
    }
}
