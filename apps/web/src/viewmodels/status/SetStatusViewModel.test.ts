// @vitest-environment happy-dom

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance, type MockedObject } from "vitest";

import { SetStatusViewModel, UserMenuSetStatusViewModel } from "./SetStatusViewModel";
import {
    getMockClientWithEventEmitter,
    MockEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../test/test-utils";
import type { UserStatus as MatrixUserStatus } from "@element-hq/web-shared-components";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { UserTab } from "../../components/views/dialogs/UserTab";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import * as recent from "../../emojipicker/recent";

vi.mock("../../emojipicker/recent", () => ({
    add: vi.fn(),
    get: vi.fn(),
}));

const STATUS: MatrixUserStatus = { emoji: "🧪", text: "Testing" };

describe("SetStatusViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let mockOwnProfileStoreInstance: MockEventEmitter<OwnProfileStore> & OwnProfileStore;

    beforeEach(() => {
        mockOwnProfileStoreInstance = new MockEventEmitter<OwnProfileStore>({
            userStatus: undefined,
        }) as unknown as MockEventEmitter<OwnProfileStore> & OwnProfileStore;

        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            getExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
            setExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
        });
        vi.mocked(mockOwnProfileStoreInstance).userStatus = undefined;
        vi.mocked(recent.get).mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("initialises snapshot from OwnProfileStore userStatus", () => {
        vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
        const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        expect(vm.getSnapshot().userStatus).toEqual(STATUS);
    });

    it("initialises snapshot with undefined when no status is set", () => {
        const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        expect(vm.getSnapshot().userStatus).toBeUndefined();
    });

    it("initialises snapshot from the recently used emojis", () => {
        vi.mocked(recent.get).mockReturnValue(["🧪", "🦎"]);
        const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        expect(vm.getSnapshot().recentEmojis).toEqual(["🧪", "🦎"]);
    });

    it("updates the snapshot when OwnProfileStore emits an update", () => {
        const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        expect(vm.getSnapshot().userStatus).toBeUndefined();

        vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
        mockOwnProfileStoreInstance.emit(UPDATE_EVENT);

        expect(vm.getSnapshot().userStatus).toEqual(STATUS);
    });

    it("stops listening to OwnProfileStore once disposed", () => {
        const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        vm.dispose();

        vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
        mockOwnProfileStoreInstance.emit(UPDATE_EVENT);

        expect(vm.getSnapshot().userStatus).toBeUndefined();
    });

    describe("setStatus", () => {
        it("optimistically updates the snapshot", () => {
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.setStatus(STATUS);
            expect(vm.getSnapshot().userStatus).toEqual(STATUS);
        });

        it("calls setExtendedProfileProperty with the new status", async () => {
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.setStatus(STATUS);
            await waitFor(() =>
                expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", {
                    emoji: STATUS.emoji,
                    text: STATUS.text,
                }),
            );
        });

        it("notifies subscribers of the update", () => {
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            const subscriber = vi.fn();
            vm.subscribe(subscriber);
            vm.setStatus(STATUS);
            expect(subscriber).toHaveBeenCalledTimes(1);
        });

        it("rolls back the snapshot on failure", async () => {
            vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
            client.setExtendedProfileProperty.mockRejectedValue(new Error("network error"));
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });

            const newStatus = { emoji: "🦎", text: "Gecko" };
            vm.setStatus(newStatus);
            expect(vm.getSnapshot().userStatus).toEqual(newStatus);

            await waitFor(() => expect(vm.getSnapshot().userStatus).toEqual(STATUS));
        });
    });

    describe("recordRecentEmoji", () => {
        it("records the emoji as recently used", () => {
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.recordRecentEmoji("🎉");
            expect(recent.add).toHaveBeenCalledWith("🎉");
        });

        it("updates the snapshot with the new list of recent emojis", () => {
            vi.mocked(recent.get).mockReturnValue(["🧪"]);
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            expect(vm.getSnapshot().recentEmojis).toEqual(["🧪"]);

            vi.mocked(recent.get).mockReturnValue(["🎉", "🧪"]);
            vm.recordRecentEmoji("🎉");

            expect(vm.getSnapshot().recentEmojis).toEqual(["🎉", "🧪"]);
        });
    });

    describe("clearStatus", () => {
        it("optimistically clears the snapshot", () => {
            vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.clearStatus();
            expect(vm.getSnapshot().userStatus).toBeUndefined();
        });

        it("calls setExtendedProfileProperty with null", async () => {
            client.getExtendedProfileProperty.mockResolvedValue(STATUS);
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.clearStatus();
            await waitFor(() =>
                expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", null),
            );
        });

        it("notifies subscribers of the update", () => {
            vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            const subscriber = vi.fn();
            vm.subscribe(subscriber);
            vm.clearStatus();
            expect(subscriber).toHaveBeenCalledTimes(1);
        });

        it("rolls back the snapshot on failure", async () => {
            vi.mocked(mockOwnProfileStoreInstance).userStatus = STATUS;
            client.getExtendedProfileProperty.mockResolvedValue(STATUS);
            client.setExtendedProfileProperty.mockRejectedValue(new Error("network error"));
            const vm = new SetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
            vm.clearStatus();
            expect(vm.getSnapshot().userStatus).toBeUndefined();

            await waitFor(() => expect(vm.getSnapshot().userStatus).toEqual(STATUS));
        });
    });
});

describe("UserMenuSetStatusViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let dispatchSpy: MockInstance;
    let mockOwnProfileStoreInstance: MockEventEmitter<OwnProfileStore> & OwnProfileStore;

    beforeEach(() => {
        mockOwnProfileStoreInstance = new MockEventEmitter<OwnProfileStore>({
            userStatus: undefined,
        }) as unknown as MockEventEmitter<OwnProfileStore> & OwnProfileStore;
        vi.spyOn(OwnProfileStore, "instance", "get").mockReturnValue(mockOwnProfileStoreInstance);

        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            getExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
            setExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
        });
        vi.mocked(mockOwnProfileStoreInstance).userStatus = undefined;
        dispatchSpy = vi.spyOn(dis, "dispatch").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("dispatches ToggleUserMenu and ViewUserSettings on onSetStatusClick", async () => {
        const vm = new UserMenuSetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        vm.onSetStatusClick();
        await waitFor(() => {
            expect(dispatchSpy).toHaveBeenCalledWith({ action: Action.ToggleUserMenu });
            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Account,
            });
        });
    });

    it("inherits setStatus from SetStatusViewModel", async () => {
        const vm = new UserMenuSetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        vm.setStatus(STATUS);
        await waitFor(() =>
            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", {
                emoji: STATUS.emoji,
                text: STATUS.text,
            }),
        );
    });

    it("inherits clearStatus from SetStatusViewModel", async () => {
        client.getExtendedProfileProperty.mockResolvedValue(STATUS);
        const vm = new UserMenuSetStatusViewModel({ client, ownProfileStore: mockOwnProfileStoreInstance });
        vm.clearStatus();
        await waitFor(() =>
            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", null),
        );
    });
});
