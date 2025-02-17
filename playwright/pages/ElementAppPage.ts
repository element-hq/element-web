/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page, expect } from "@playwright/test";

import { Settings } from "./settings";
import { Client } from "./client";
import { Timeline } from "./timeline";
import { Spotlight } from "./Spotlight";

/**
 * A set of utility methods for interacting with the Element-Web UI.
 */
export class ElementAppPage {
    public constructor(public readonly page: Page) {}

    // We create these lazily on first access to avoid calling setup code which might cause conflicts,
    // e.g. the network routing code in the client subfixture.
    private _settings?: Settings;
    public get settings(): Settings {
        if (!this._settings) this._settings = new Settings(this.page);
        return this._settings;
    }
    private _client?: Client;
    public get client(): Client {
        if (!this._client) this._client = new Client(this.page);
        return this._client;
    }
    private _timeline?: Timeline;
    public get timeline(): Timeline {
        if (!this._timeline) this._timeline = new Timeline(this.page);
        return this._timeline;
    }

    public async cleanup() {
        await this._client?.cleanup();
    }

    /**
     * Open the top left user menu, returning a Locator to the resulting context menu.
     */
    public async openUserMenu(): Promise<Locator> {
        return this.settings.openUserMenu();
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
        return this.settings.closeDialog();
    }

    public async getClipboard(): Promise<string> {
        return await this.page.evaluate(() => navigator.clipboard.readText());
    }

    /**
     * Opens the given room by name. The room must be visible in the
     * room list, but the room list may be folded horizontally, and the
     * room may contain unread messages.
     *
     * @param name The exact room name to find and click on/open.
     */
    public async viewRoomByName(name: string): Promise<void> {
        // We look for the room inside the room list, which is a tree called Rooms.
        //
        // There are 3 cases:
        // - the room list is folded:
        //     then the aria-label on the room tile is the name (with nothing extra)
        // - the room list is unfolder and the room has messages:
        //     then the aria-label contains the unread count, but the title of the
        //     div inside the titleContainer equals the room name
        // - the room list is unfolded and the room has no messages:
        //     then the aria-label is the name and so is the title of a div
        //
        // So by matching EITHER title=name OR aria-label=name we find this exact
        // room in all three cases.
        return this.page
            .getByRole("tree", { name: "Rooms" })
            .locator(`[title="${name}"],[aria-label="${name}"]`)
            .first()
            .click();
    }

    public async viewRoomById(roomId: string): Promise<void> {
        await this.page.goto(`/#/room/${roomId}`);
    }

    /**
     * Get the composer element
     * @param isRightPanel whether to select the right panel composer, otherwise the main timeline composer
     */
    public getComposer(isRightPanel?: boolean): Locator {
        const panelClass = isRightPanel ? ".mx_RightPanel" : ".mx_RoomView_body";
        return this.page.locator(`${panelClass} .mx_MessageComposer`);
    }

    /**
     * Get the composer input field
     * @param isRightPanel whether to select the right panel composer, otherwise the main timeline composer
     */
    public getComposerField(isRightPanel?: boolean): Locator {
        return this.getComposer(isRightPanel).locator("[contenteditable]");
    }

    /**
     * Open the message composer kebab menu
     * @param isRightPanel whether to select the right panel composer, otherwise the main timeline composer
     */
    public async openMessageComposerOptions(isRightPanel?: boolean): Promise<Locator> {
        const composer = this.getComposer(isRightPanel);
        await composer.getByRole("button", { name: "More options", exact: true }).click();
        return this.page.getByRole("menu");
    }

    /**
     * Returns the space panel space button based on a name. The space
     * must be visible in the space panel
     * @param name The space name to find
     */
    public async getSpacePanelButton(name: string): Promise<Locator> {
        const button = this.page.getByRole("button", { name: name });
        await expect(button).toHaveClass(/mx_SpaceButton/);
        return button;
    }

    /**
     * Opens the given space home by name. The space must be visible in
     * the space list.
     * @param name The space name to find and click on/open.
     */
    public async viewSpaceHomeByName(name: string): Promise<void> {
        const button = await this.getSpacePanelButton(name);
        return button.dblclick();
    }

    /**
     * Opens the given space by name. The space must be visible in the
     * space list.
     * @param name The space name to find and click on/open.
     */
    public async viewSpaceByName(name: string): Promise<void> {
        const button = await this.getSpacePanelButton(name);
        return button.click();
    }

    public async openSpotlight(): Promise<Spotlight> {
        const spotlight = new Spotlight(this.page);
        await spotlight.open();
        return spotlight;
    }

    /**
     * Opens/closes the room info panel
     * @returns locator to the right panel
     */
    public async toggleRoomInfoPanel(): Promise<Locator> {
        await this.page.getByRole("button", { name: "Room info" }).first().click();
        return this.page.locator(".mx_RightPanel");
    }

    /**
     * Opens/closes the memberlist panel
     * @returns locator to the memberlist panel
     */
    public async toggleMemberlistPanel(): Promise<Locator> {
        const locator = this.page.locator(".mx_FacePile");
        await locator.click();
        const memberlist = this.page.locator(".mx_MemberListView");
        await memberlist.waitFor();
        return memberlist;
    }

    /**
     * Get a locator for the tooltip associated with an element
     * @param e The element with the tooltip
     * @returns Locator to the tooltip
     */
    public async getTooltipForElement(e: Locator): Promise<Locator> {
        const [labelledById, describedById] = await Promise.all([
            e.getAttribute("aria-labelledby"),
            e.getAttribute("aria-describedby"),
        ]);
        if (!labelledById && !describedById) {
            throw new Error(
                "Element has no aria-labelledby or aria-describedy attributes! The tooltip should have added either one of these.",
            );
        }
        return this.page.locator(`id=${labelledById ?? describedById}`);
    }

    /**
     * Close the notification toast
     */
    public closeNotificationToast(): Promise<void> {
        // Dismiss "Notification" toast
        return this.page
            .locator(".mx_Toast_toast", { hasText: "Notifications" })
            .getByRole("button", { name: "Dismiss" })
            .click();
    }
}
