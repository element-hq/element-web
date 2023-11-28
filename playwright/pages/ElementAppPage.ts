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

import { type Locator, type Page } from "@playwright/test";

import type { IContent, ICreateRoomOpts, ISendEventResponse } from "matrix-js-sdk/src/matrix";
import type { SettingLevel } from "../../src/settings/SettingLevel";

export class ElementAppPage {
    public constructor(private readonly page: Page) {}

    /**
     * Sets the value for a setting. The room ID is optional if the
     * setting is not being set for a particular room, otherwise it
     * should be supplied. The value may be null to indicate that the
     * level should no longer have an override.
     * @param {string} settingName The name of the setting to change.
     * @param {String} roomId The room ID to change the value in, may be
     * null.
     * @param {SettingLevel} level The level to change the value at.
     * @param {*} value The new value of the setting, may be null.
     * @return {Promise} Resolves when the setting has been changed.
     */
    public async setSettingValue(settingName: string, roomId: string, level: SettingLevel, value: any): Promise<void> {
        return this.page.evaluate<
            Promise<void>,
            {
                settingName: string;
                roomId: string | null;
                level: SettingLevel;
                value: any;
            }
        >(
            ({ settingName, roomId, level, value }) => {
                return window.mxSettingsStore.setValue(settingName, roomId, level, value);
            },
            { settingName, roomId, level, value },
        );
    }

    /**
     * Open the top left user menu, returning a Locator to the resulting context menu.
     */
    public async openUserMenu(): Promise<Locator> {
        await this.page.getByRole("button", { name: "User menu" }).click();
        const locator = this.page.locator(".mx_ContextualMenu");
        await locator.waitFor();
        return locator;
    }

    /**
     * Switch settings tab to the one by the given name
     * @param tab the name of the tab to switch to.
     */
    public async switchTab(tab: string): Promise<void> {
        await this.page
            .locator(".mx_TabbedView_tabLabels")
            .locator(".mx_TabbedView_tabLabel", { hasText: tab })
            .click();
    }

    /**
     * Open user settings (via user menu), returns a locator to the dialog
     * @param tab the name of the tab to switch to after opening, optional.
     */
    public async openUserSettings(tab?: string): Promise<Locator> {
        const locator = await this.openUserMenu();
        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        if (tab) await this.switchTab(tab);
        return this.page.locator(".mx_UserSettingsDialog");
    }

    /**
     * Open room creation dialog.
     */
    public async openCreateRoomDialog(): Promise<Locator> {
        await this.page.getByRole("button", { name: "Add room", exact: true }).click();
        await this.page.getByRole("menuitem", { name: "New room", exact: true }).click();
        return this.page.locator(".mx_CreateRoomDialog");
    }

    /**
     * Close dialog currently open dialog
     */
    public async closeDialog(): Promise<void> {
        return this.page.getByRole("button", { name: "Close dialog", exact: true }).click();
    }

    /**
     * Create a room with given options.
     * @param options the options to apply when creating the room
     * @return the ID of the newly created room
     */
    public async createRoom(options: ICreateRoomOpts): Promise<string> {
        return this.page.evaluate<Promise<string>, ICreateRoomOpts>(async (options) => {
            return window.mxMatrixClientPeg
                .get()
                .createRoom(options)
                .then((res) => res.room_id);
        }, options);
    }

    /**
     * Get the composer element
     * @param isRightPanel whether to select the right panel composer, otherwise the main timeline composer
     */
    public async getComposer(isRightPanel?: boolean): Promise<Locator> {
        const panelClass = isRightPanel ? ".mx_RightPanel" : ".mx_RoomView_body";
        return this.page.locator(`${panelClass} .mx_MessageComposer`);
    }

    /**
     * Open the message composer kebab menu
     * @param isRightPanel whether to select the right panel composer, otherwise the main timeline composer
     */
    public async openMessageComposerOptions(isRightPanel?: boolean): Promise<Locator> {
        const composer = await this.getComposer(isRightPanel);
        await composer.getByRole("button", { name: "More options", exact: true }).click();
        return this.page.getByRole("menu");
    }

    /**
     * @param {string} roomId
     * @param {string} threadId
     * @param {string} eventType
     * @param {Object} content
     */
    public async sendEvent(
        roomId: string,
        threadId: string | null,
        eventType: string,
        content: IContent,
    ): Promise<ISendEventResponse> {
        return this.page.evaluate<
            Promise<ISendEventResponse>,
            {
                roomId: string;
                threadId: string | null;
                eventType: string;
                content: IContent;
            }
        >(
            async ({ roomId, threadId, eventType, content }) => {
                return window.mxMatrixClientPeg.get().sendEvent(roomId, threadId, eventType, content);
            },
            { roomId, threadId, eventType, content },
        );
    }
}
