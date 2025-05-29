/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import type { Preset, ICreateRoomOpts } from "matrix-js-sdk/src/matrix";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { isDendrite } from "../../plugins/homeserver/dendrite";

async function openSpaceCreateMenu(page: Page): Promise<Locator> {
    await page.getByRole("button", { name: "Create a space" }).click();
    return page.locator(".mx_SpaceCreateMenu_wrapper .mx_ContextualMenu");
}

async function openSpaceContextMenu(page: Page, app: ElementAppPage, spaceName: string): Promise<Locator> {
    const button = await app.getSpacePanelButton(spaceName);
    await button.click({ button: "right" });
    return page.locator(".mx_SpacePanel_contextMenu");
}

function spaceCreateOptions(spaceName: string, roomIds: string[] = []): ICreateRoomOpts {
    return {
        creation_content: {
            type: "m.space",
        },
        initial_state: [
            {
                type: "m.room.name",
                content: {
                    name: spaceName,
                },
            },
            ...roomIds.map((r) => spaceChildInitialState(r)),
        ],
    };
}

function spaceChildInitialState(roomId: string, order?: string): ICreateRoomOpts["initial_state"]["0"] {
    return {
        type: "m.space.child",
        state_key: roomId,
        content: {
            via: [roomId.split(":")[1]],
            order,
        },
    };
}

test.describe("Spaces", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3488");
    test.use({
        displayName: "Sue",
        botCreateOpts: { displayName: "BotBob" },
    });

    test(
        "should allow user to create public space",
        { tag: ["@screenshot", "@no-webkit"] },
        async ({ page, app, user }) => {
            const contextMenu = await openSpaceCreateMenu(page);
            await expect(contextMenu).toMatchScreenshot("space-create-menu.png");

            await contextMenu.getByRole("button", { name: /Public/ }).click();

            await contextMenu
                .locator('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
                .setInputFiles("playwright/sample-files/riot.png");
            await contextMenu.getByRole("textbox", { name: "Name" }).fill("Let's have a Riot");
            await expect(contextMenu.getByRole("textbox", { name: "Address" })).toHaveValue("lets-have-a-riot");
            await contextMenu
                .getByRole("textbox", { name: "Description" })
                .fill("This is a space to reminisce Riot.im!");
            await contextMenu.getByRole("button", { name: "Create" }).click();

            // Create the default General & Random rooms, as well as a custom "Jokes" room
            await expect(page.getByPlaceholder("General")).toBeVisible();
            await expect(page.getByPlaceholder("Random")).toBeVisible();
            await page.getByPlaceholder("Support").fill("Jokes");
            await page.getByRole("button", { name: "Continue" }).click();

            // Copy matrix.to link
            await page.getByRole("button", { name: "Share invite link" }).click();
            expect(await app.getClipboard()).toEqual(`https://matrix.to/#/#lets-have-a-riot:${user.homeServer}`);

            // Go to space home
            await page.getByRole("button", { name: "Go to my first room" }).click();

            // Assert rooms exist in the room list
            await expect(page.getByRole("treeitem", { name: "General" })).toBeVisible();
            await expect(page.getByRole("treeitem", { name: "Random" })).toBeVisible();
            await expect(page.getByRole("treeitem", { name: "Jokes" })).toBeVisible();
        },
    );

    test("should allow user to create private space", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const menu = await openSpaceCreateMenu(page);
        await menu.getByRole("button", { name: "Private" }).click();

        await menu
            .locator('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
            .setInputFiles("playwright/sample-files/riot.png");
        await menu.getByRole("textbox", { name: "Name" }).fill("This is not a Riot");
        await expect(menu.getByRole("textbox", { name: "Address" })).not.toBeVisible();
        await menu.getByRole("textbox", { name: "Description" }).fill("This is a private space of mourning Riot.im...");
        await menu.getByRole("button", { name: "Create" }).click();

        await page.getByRole("button", { name: "Me and my teammates" }).click();

        // Create the default General & Random rooms, as well as a custom "Projects" room
        await expect(page.getByPlaceholder("General")).toBeVisible();
        await expect(page.getByPlaceholder("Random")).toBeVisible();
        await page.getByPlaceholder("Support").fill("Projects");
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.locator(".mx_SpaceRoomView h1").getByText("Invite your teammates")).toBeVisible();
        await expect(page.locator(".mx_SpaceRoomView")).toMatchScreenshot("invite-teammates-dialog.png");
        await page.getByRole("button", { name: "Skip for now" }).click();

        // Assert rooms exist in the room list
        const roomList = page.getByRole("tree", { name: "Rooms" });
        await expect(roomList.getByRole("treeitem", { name: "General", exact: true })).toBeVisible();
        await expect(roomList.getByRole("treeitem", { name: "Random", exact: true })).toBeVisible();
        await expect(roomList.getByRole("treeitem", { name: "Projects", exact: true })).toBeVisible();

        // Assert rooms exist in the space explorer
        await expect(
            page.locator(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", { hasText: "General" }),
        ).toBeVisible();
        await expect(
            page.locator(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", { hasText: "Random" }),
        ).toBeVisible();
        await expect(
            page.locator(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", { hasText: "Projects" }),
        ).toBeVisible();
    });

    test("should allow user to create just-me space", async ({ page, app, user }) => {
        await app.client.createRoom({
            name: "Sample Room",
        });

        const menu = await openSpaceCreateMenu(page);
        await menu.getByRole("button", { name: "Private" }).click();

        await menu
            .locator('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
            .setInputFiles("playwright/sample-files/riot.png");
        await expect(menu.getByRole("textbox", { name: "Address" })).not.toBeVisible();
        await menu.getByRole("textbox", { name: "Description" }).fill("This is a personal space to mourn Riot.im...");
        await menu.getByRole("textbox", { name: "Name" }).fill("This is my Riot");
        await menu.getByRole("textbox", { name: "Name" }).press("Enter");

        await page.getByRole("button", { name: "Just me" }).click();

        await page.getByRole("checkbox", { name: "Sample Room" }).click();

        // Temporal implementation as multiple elements with the role "button" and name "Add" are found
        await page.locator(".mx_AddExistingToSpace_footer").getByRole("button", { name: "Add" }).click();

        await expect(
            page.locator(".mx_SpaceHierarchy_list").getByRole("treeitem", { name: "Sample Room" }),
        ).toBeVisible();
    });

    test(
        "should allow user to add an existing room to a space after creation",
        { tag: "@screenshot" },
        async ({ page, app, user }) => {
            await app.client.createRoom({
                name: "Sample Room",
            });
            await app.client.createRoom({
                name: "A Room that will not be selected",
            });

            const menu = await openSpaceCreateMenu(page);
            await menu.getByRole("button", { name: "Private" }).click();

            await menu
                .locator('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
                .setInputFiles("playwright/sample-files/riot.png");
            await expect(menu.getByRole("textbox", { name: "Address" })).not.toBeVisible();
            await menu
                .getByRole("textbox", { name: "Description" })
                .fill("This is a personal space to mourn Riot.im...");
            await menu.getByRole("textbox", { name: "Name" }).fill("This is my Riot");
            await menu.getByRole("textbox", { name: "Name" }).press("Enter");

            await page.getByRole("button", { name: "Just me" }).click();

            await page.getByRole("button", { name: "Skip for now" }).click();

            await page.getByRole("button", { name: "Add room" }).click();
            await page.getByRole("menuitem", { name: "Add existing room" }).click();

            await page.getByRole("checkbox", { name: "Sample Room" }).click();

            await expect(page.getByRole("dialog", { name: "Avatar Add existing rooms" })).toMatchScreenshot(
                "add-existing-rooms-dialog.png",
            );

            await page.getByRole("button", { name: "Add" }).click();
            await expect(
                page.locator(".mx_SpaceHierarchy_list").getByRole("treeitem", { name: "Sample Room" }),
            ).toBeVisible();
        },
    );

    test("should allow user to invite another to a space", { tag: "@no-webkit" }, async ({ page, app, user, bot }) => {
        await app.client.createSpace({
            visibility: "public" as any,
            room_alias_name: "space",
        });

        const menu = await openSpaceContextMenu(page, app, `#space:${user.homeServer}`);
        await menu.getByRole("menuitem", { name: "Invite" }).click();

        const shareDialog = page.locator(".mx_SpacePublicShare");
        // Copy link first
        await shareDialog.getByRole("button", { name: "Share invite link" }).click();
        expect(await app.getClipboard()).toEqual(`https://matrix.to/#/#space:${user.homeServer}`);
        // Start Matrix invite flow
        await shareDialog.getByRole("button", { name: "Invite people" }).click();

        const otherSection = page.locator(".mx_InviteDialog_other");
        await otherSection.getByRole("textbox").fill(bot.credentials.userId);
        await otherSection.getByRole("button", { name: "Invite" }).click();

        await expect(page.locator(".mx_InviteDialog_other")).not.toBeVisible();
    });

    test("should show space invites at the top of the space panel", async ({ page, app, user, bot }) => {
        await app.client.createSpace({
            name: "My Space",
        });
        await expect(await app.getSpacePanelButton("My Space")).toBeVisible();

        const roomId = await bot.createRoom(spaceCreateOptions("Space Space"));
        await bot.inviteUser(roomId, user.userId);

        // Assert that `Space Space` is above `My Space` due to it being an invite
        const buttons = page.getByRole("tree", { name: "Spaces" }).locator(".mx_SpaceButton");
        await expect(buttons.nth(1)).toHaveAttribute("aria-label", "Space Space");
        await expect(buttons.nth(2)).toHaveAttribute("aria-label", "My Space");
    });

    test("should include rooms in space home", async ({ page, app, user }) => {
        const roomId1 = await app.client.createRoom({
            name: "Music",
        });
        const roomId2 = await app.client.createRoom({
            name: "Gaming",
        });

        const spaceName = "Spacey Mc. Space Space";
        await app.client.createSpace({
            name: spaceName,
            initial_state: [spaceChildInitialState(roomId1), spaceChildInitialState(roomId2)],
        });

        await app.viewSpaceHomeByName(spaceName);

        const hierarchyList = page.locator(".mx_SpaceRoomView .mx_SpaceHierarchy_list");
        await expect(hierarchyList.getByRole("treeitem", { name: "Music" }).getByRole("button")).toBeVisible();
        await expect(hierarchyList.getByRole("treeitem", { name: "Gaming" }).getByRole("button")).toBeVisible();
    });

    test(
        "should render subspaces in the space panel only when expanded",
        { tag: "@screenshot" },
        async ({ page, app, user, axe }) => {
            axe.disableRules([
                // Disable this check as it triggers on nested roving tab index elements which are in practice fine
                "nested-interactive",
                // XXX: We have some known contrast issues here
                "color-contrast",
            ]);

            const childSpaceId = await app.client.createSpace({
                name: "Child Space",
                initial_state: [],
            });
            await app.client.createSpace({
                name: "Root Space",
                initial_state: [spaceChildInitialState(childSpaceId)],
            });

            // Find collapsed Space panel
            const spaceTree = page.getByRole("tree", { name: "Spaces" });
            await expect(spaceTree.getByRole("button", { name: "Root Space" })).toBeVisible();
            await expect(spaceTree.getByRole("button", { name: "Child Space" })).not.toBeVisible();

            await expect(axe).toHaveNoViolations();
            await expect(page.locator(".mx_SpacePanel")).toMatchScreenshot("space-panel-collapsed.png");

            // This finds the expand button with the class name "mx_SpaceButton_toggleCollapse". Note there is another
            // button with the same name with different class name "mx_SpacePanel_toggleCollapse".
            await spaceTree.getByRole("button", { name: "Expand" }).click();
            await expect(page.locator(".mx_SpacePanel:not(.collapsed)")).toBeVisible(); // TODO: replace :not() selector

            const item = page.locator(".mx_SpaceItem", { hasText: "Root Space" });
            await expect(item).toBeVisible();
            await expect(item.locator(".mx_SpaceItem", { hasText: "Child Space" })).toBeVisible();

            await expect(axe).toHaveNoViolations();
            await expect(page.locator(".mx_SpacePanel")).toMatchScreenshot("space-panel-expanded.png");
        },
    );

    test("should not soft crash when joining a room from space hierarchy which has a link in its topic", async ({
        page,
        app,
        user,
        bot,
    }) => {
        const roomId = await bot.createRoom({
            preset: "public_chat" as Preset,
            name: "Test Room",
            topic: "This is a topic https://github.com/matrix-org/matrix-react-sdk/pull/10060 with a link",
        });
        const spaceId = await bot.createRoom(spaceCreateOptions("Test Space", [roomId]));
        await bot.inviteUser(spaceId, user.userId);

        await expect(await app.getSpacePanelButton("Test Space")).toBeVisible();
        await app.viewSpaceByName("Test Space");
        await page.getByRole("button", { name: "Accept" }).click();

        await page.getByRole("button", { name: "Test Room" }).hover();
        await page.getByRole("button", { name: "Join", exact: true }).click();
        await page.getByRole("button", { name: "View", exact: true }).click();

        // Assert we get shown the new room intro, and thus not the soft crash screen
        await expect(page.locator(".mx_NewRoomIntro")).toBeVisible();
    });

    test("should render spaces view", { tag: "@screenshot" }, async ({ page, app, user, axe }) => {
        axe.disableRules([
            // Disable this check as it triggers on nested roving tab index elements which are in practice fine
            "nested-interactive",
            // XXX: We have some known contrast issues here
            "color-contrast",
        ]);

        const childSpaceId1 = await app.client.createSpace({
            name: "Child Space 1",
            initial_state: [],
        });
        const childSpaceId2 = await app.client.createSpace({
            name: "Child Space 2",
            initial_state: [],
        });
        const childSpaceId3 = await app.client.createSpace({
            name: "Child Space 3",
            initial_state: [],
        });
        await app.client.createSpace({
            name: "Root Space",
            initial_state: [
                spaceChildInitialState(childSpaceId1, "a"),
                spaceChildInitialState(childSpaceId2, "b"),
                spaceChildInitialState(childSpaceId3, "c"),
            ],
        });
        await app.viewSpaceByName("Root Space");
        await expect(page.locator(".mx_SpaceRoomView")).toMatchScreenshot("space-room-view.png");
    });
});
