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
