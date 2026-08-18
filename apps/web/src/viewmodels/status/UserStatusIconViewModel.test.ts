// @vitest-environment happy-dom

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import { getMockClientWithEventEmitter, mockClientMethodsServer, mockClientMethodsUser } from "test-utils";

import { UserStatusIconViewModel } from "./UserStatusIconViewModel";
import SettingsStore from "../../settings/SettingsStore";

const userId = "@alice:example.com";

describe("UserStatusIconViewModel", () => {
    let client: MockedObject<MatrixClient>;

    beforeEach(() => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name): any => {
            if (name === "feature_user_status") return true;
        });

        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            doesServerSupportExtendedProfiles: vi.fn().mockResolvedValue(true),
            getExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("initialises with an undefined status", () => {
        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });
        expect(vm.getSnapshot().status).toBeUndefined();
    });

    it("does not fetch a status when the feature is disabled", async () => {
        vi.mocked(SettingsStore.getValue).mockReturnValue(false);
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });

        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });

        await waitFor(() => expect(client.doesServerSupportExtendedProfiles).not.toHaveBeenCalled());
        expect(vm.getSnapshot().status).toBeUndefined();
    });

    it("fetches and populates the status on construction", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });

        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });

        await waitFor(() => expect(vm.getSnapshot().status).toEqual({ emoji: "🐎", text: "on a horse" }));
    });

    it("updates the status when a matching UserProfileUpdate event is emitted", async () => {
        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());

        client.emit(ClientEvent.UserProfileUpdate, userId, {
            "org.matrix.msc4426.status": { emoji: "😵", text: "off a horse" },
        });

        expect(vm.getSnapshot().status).toEqual({ emoji: "😵", text: "off a horse" });
    });

    it("ignores UserProfileUpdate events for other users", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });
        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });
        await waitFor(() => expect(vm.getSnapshot().status).toEqual({ emoji: "🐎", text: "on a horse" }));

        client.emit(ClientEvent.UserProfileUpdate, "@bob:example.com", {
            "org.matrix.msc4426.status": { emoji: "🤷", text: "unrelated status" },
        });

        expect(vm.getSnapshot().status).toEqual({ emoji: "🐎", text: "on a horse" });
    });

    it("stops listening for updates once disposed", async () => {
        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());
        vm.dispose();

        client.emit(ClientEvent.UserProfileUpdate, userId, {
            "org.matrix.msc4426.status": { emoji: "😵", text: "off a horse" },
        });

        expect(vm.getSnapshot().status).toBeUndefined();
    });

    it("does not update the snapshot if disposed before the initial fetch resolves", async () => {
        let resolveFetch: (value: unknown) => void = () => {};
        client.getExtendedProfileProperty.mockReturnValue(
            new Promise((resolve) => {
                resolveFetch = resolve;
            }),
        );

        const vm = new UserStatusIconViewModel({ userId, matrixClient: client });
        vm.dispose();
        resolveFetch({ emoji: "🐎", text: "on a horse" });

        await Promise.resolve();
        expect(vm.getSnapshot().status).toBeUndefined();
    });
});
