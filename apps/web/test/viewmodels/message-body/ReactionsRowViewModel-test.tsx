/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import { type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import {
    MAX_ITEMS_WHEN_LIMITED,
    ReactionsRowViewModel,
    type ReactionsRowItemInput,
} from "../../../src/viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";
import { createTestClient, mkEvent, mkStubRoom } from "../../test-utils";

describe("ReactionsRowViewModel", () => {
    let client: MatrixClient;
    let room: Room;
    let mxEvent: MatrixEvent;

    const createVm = (
        overrides?: Partial<ConstructorParameters<typeof ReactionsRowViewModel>[0]>,
    ): ReactionsRowViewModel =>
        new ReactionsRowViewModel({
            isActionable: true,
            reactionGroupCount: 10,
            canReact: true,
            ...overrides,
        });

    const createReactionEvent = (senderId: string, key = "👍"): MatrixEvent =>
        mkEvent({
            event: true,
            type: "m.reaction",
            room: room.roomId,
            user: senderId,
            content: {
                "m.relates_to": {
                    rel_type: "m.annotation",
                    event_id: mxEvent.getId(),
                    key,
                },
            },
        });

    const createItem = (content: string, overrides: Partial<ReactionsRowItemInput> = {}): ReactionsRowItemInput => ({
        client,
        mxEvent,
        content,
        reactionEvents: [createReactionEvent("@alice:example.org", content)],
        canReact: true,
        canSelfRedact: true,
        ...overrides,
    });

    beforeEach(() => {
        client = createTestClient();
        room = mkStubRoom("!room:example.org", "Test Room", client);
        jest.spyOn(client, "getRoom").mockReturnValue(room);
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: room.roomId,
            user: "@sender:example.org",
            content: { body: "Test message", msgtype: "m.text" },
        });
    });

    it("computes initial snapshot from props", () => {
        const vm = createVm();
        const snapshot = vm.getSnapshot();

        expect(snapshot.isVisible).toBe(true);
        expect(snapshot.showAllButtonVisible).toBe(true);
        expect(snapshot.showAddReactionButton).toBe(true);
        expect(snapshot.addReactionButtonActive).toBe(false);
        expect(snapshot.addReactionMenuAnchorRect).toBeUndefined();
        expect(snapshot.isAddReactionMenuOpen).toBe(false);
    });

    it("hides show-all after onShowAllClick", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.onShowAllClick();

        expect(vm.getSnapshot().showAllButtonVisible).toBe(false);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates visibility when reaction group count changes", () => {
        const vm = createVm();

        vm.setReactionGroupCount(0);

        expect(vm.getSnapshot().isVisible).toBe(false);
    });

    it("updates add-reaction button visibility from canReact", () => {
        const vm = createVm();

        vm.setCanReact(false);

        expect(vm.getSnapshot().showAddReactionButton).toBe(false);
    });

    it("opens and closes the add-reaction menu", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.openAddReactionMenu(anchor);

        expect(vm.getSnapshot().addReactionButtonActive).toBe(true);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(true);

        vm.closeAddReactionMenu();

        expect(vm.getSnapshot().addReactionButtonActive).toBe(false);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBeUndefined();
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(false);
    });

    it("opens the add-reaction menu from add-reaction actions", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        const preventDefault = jest.fn();
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.onAddReactionClick({ currentTarget: anchor } as MouseEvent<HTMLButtonElement>);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);

        vm.closeAddReactionMenu();
        vm.onAddReactionContextMenu({
            currentTarget: anchor,
            preventDefault,
        } as unknown as MouseEvent<HTMLButtonElement>);

        expect(preventDefault).toHaveBeenCalled();
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);
    });

    it("closes the add-reaction menu when reactions become unavailable", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.openAddReactionMenu(anchor);
        vm.setCanReact(false);

        expect(vm.getSnapshot().showAddReactionButton).toBe(false);
        expect(vm.getSnapshot().addReactionButtonActive).toBe(false);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBeUndefined();
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(false);
    });

    it("creates button view models from item inputs", () => {
        const vm = createVm({ reactionGroupCount: 2 });
        const duplicateSenderReaction = createReactionEvent("@alice:example.org", "👍");

        vm.setItems([
            createItem("👍", {
                reactionEvents: [createReactionEvent("@alice:example.org", "👍"), duplicateSenderReaction],
            }),
            createItem("👎"),
        ]);

        const buttonViewModels = vm.getButtonViewModels();
        expect(buttonViewModels).toHaveLength(2);
        expect(buttonViewModels[0].getSnapshot().content).toBe("👍");
        expect(buttonViewModels[0].getSnapshot().count).toBe(1);
        expect(buttonViewModels[1].getSnapshot().content).toBe("👎");
    });

    it("reuses button view models when reaction content is updated", () => {
        const vm = createVm({ reactionGroupCount: 1 });

        vm.setItems([createItem("👍")]);
        const buttonViewModel = vm.getButtonViewModels()[0];

        vm.setItems([
            createItem("👍", {
                reactionEvents: [
                    createReactionEvent("@alice:example.org", "👍"),
                    createReactionEvent("@bob:example.org", "👍"),
                ],
            }),
        ]);

        expect(vm.getButtonViewModels()[0]).toBe(buttonViewModel);
        expect(buttonViewModel.getSnapshot().count).toBe(2);
    });

    it("disposes removed button view models", () => {
        const vm = createVm({ reactionGroupCount: 2 });

        vm.setItems([createItem("👍"), createItem("👎")]);
        const removedButtonViewModel = vm.getButtonViewModels()[1];
        const disposeSpy = jest.spyOn(removedButtonViewModel, "dispose");

        vm.setItems([createItem("👍")]);

        expect(disposeSpy).toHaveBeenCalled();
        expect(vm.getButtonViewModels()).toHaveLength(1);
        expect(vm.getButtonViewModels()[0].getSnapshot().content).toBe("👍");
    });

    it("disposes owned button view models when disposed", () => {
        const vm = createVm({ reactionGroupCount: 2 });

        vm.setItems([createItem("👍"), createItem("👎")]);
        const buttonViewModels = vm.getButtonViewModels();
        const disposeSpies = buttonViewModels.map((buttonViewModel) => jest.spyOn(buttonViewModel, "dispose"));

        vm.dispose();

        expect(disposeSpies[0]).toHaveBeenCalled();
        expect(disposeSpies[1]).toHaveBeenCalled();
    });

    it("limits button view models until show-all is clicked", () => {
        const vm = createVm({ reactionGroupCount: 10 });

        vm.setItems(Array.from({ length: 10 }, (_, index) => createItem(`reaction-${index}`)));

        expect(vm.getSnapshot().showAllButtonVisible).toBe(true);
        expect(vm.getButtonViewModels()).toHaveLength(MAX_ITEMS_WHEN_LIMITED);

        vm.onShowAllClick();

        expect(vm.getSnapshot().showAllButtonVisible).toBe(false);
        expect(vm.getButtonViewModels()).toHaveLength(10);
    });

    it("computes button disabled state from reaction permissions", () => {
        const vm = createVm({ reactionGroupCount: 1 });
        const myReactionEvent = createReactionEvent("@me:example.org", "👍");

        vm.setItems([
            createItem("👍", {
                myReactionEvent,
                canReact: true,
                canSelfRedact: false,
            }),
        ]);

        expect(vm.getButtonViewModels()[0].getSnapshot().isDisabled).toBe(true);

        vm.setItems([
            createItem("👍", {
                myReactionEvent,
                canReact: true,
                canSelfRedact: true,
            }),
        ]);

        expect(vm.getButtonViewModels()[0].getSnapshot().isDisabled).toBe(false);

        vm.setItems([
            createItem("👍", {
                canReact: false,
                canSelfRedact: true,
            }),
        ]);

        expect(vm.getButtonViewModels()[0].getSnapshot().isDisabled).toBe(true);
    });

    it("does not emit when derived values are unchanged", () => {
        const vm = createVm();
        const previousSnapshot = vm.getSnapshot();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCanReact(true);
        vm.setReactionGroupCount(10);
        vm.setActionable(true);

        // Snapshot merges skip emitting when all derived values are unchanged.
        expect(listener).toHaveBeenCalledTimes(0);
        expect(vm.getSnapshot()).toEqual(previousSnapshot);
    });
});
