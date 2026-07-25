/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { type MockedObject, mocked } from "jest-mock";

import { stubClient } from "../../test-utils";
import { OwnProfileStore } from "../../../src/stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import SettingsStore from "../../../src/settings/SettingsStore";

describe("OwnProfileStore", () => {
    let client: MockedObject<MatrixClient>;
    let ownProfileStore: OwnProfileStore;
    let onUpdate: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        client = mocked(stubClient());
        onUpdate = jest.fn();
        ownProfileStore = new OwnProfileStore();
        ownProfileStore.addListener(UPDATE_EVENT, onUpdate);
    });

    afterEach(() => {
        ownProfileStore.removeListener(UPDATE_EVENT, onUpdate);
    });

    it("if the client has not yet been started, the displayname and avatar should be null", () => {
        expect(onUpdate).not.toHaveBeenCalled();
        expect(ownProfileStore.displayName).toBeNull();
        expect(ownProfileStore.avatarMxc).toBeNull();
    });

    it("if the client has been started and there is a profile, it should return the profile display name and avatar", async () => {
        client.getProfileInfo.mockResolvedValue({
            displayname: "Display Name",
            avatar_url: "mxc://example.com/abc123",
        });
        await ownProfileStore.start();

        expect(onUpdate).toHaveBeenCalled();
        expect(ownProfileStore.displayName).toBe("Display Name");
        expect(ownProfileStore.avatarMxc).toBe("mxc://example.com/abc123");
    });

    it("if there is a M_NOT_FOUND error, it should report ready, displayname = MXID and avatar = null", async () => {
        client.getProfileInfo.mockRejectedValue(
            new MatrixError({
                error: "Not found",
                errcode: "M_NOT_FOUND",
            }),
        );
        await ownProfileStore.start();

        expect(onUpdate).toHaveBeenCalled();
        expect(ownProfileStore.displayName).toBe(client.getSafeUserId());
        expect(ownProfileStore.avatarMxc).toBeNull();
    });

    it("if there is any other error, it should not report ready, displayname = MXID and avatar = null", async () => {
        client.getProfileInfo.mockRejectedValue(
            new MatrixError({
                error: "Forbidden",
                errcode: "M_FORBIDDEN",
            }),
        );
        try {
            await ownProfileStore.start();
        } catch {}

        expect(onUpdate).not.toHaveBeenCalled();
        expect(ownProfileStore.displayName).toBe(client.getSafeUserId());
        expect(ownProfileStore.avatarMxc).toBeNull();
    });

    describe("userStatus", () => {
        beforeEach(() => {
            client.getProfileInfo.mockResolvedValue({});
        });

        it("should be undefined if the feature is disabled", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            await ownProfileStore.start();

            expect(ownProfileStore.userStatus).toBeUndefined();
        });

        it("should be undefined if no status is set", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            client.getExtendedProfileProperty.mockResolvedValue(undefined);
            await ownProfileStore.start();

            expect(ownProfileStore.userStatus).toBeUndefined();
        });

        it("should fetch and expose the user status on start", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🏝️", text: "On a tropical holiday" });
            await ownProfileStore.start();

            expect(client.getExtendedProfileProperty).toHaveBeenCalledWith(
                client.getSafeUserId(),
                "org.matrix.msc4426.status",
            );
            expect(ownProfileStore.userStatus).toEqual({ emoji: "🏝️", text: "On a tropical holiday" });
        });

        it("should update the user status when a UserProfileUpdate event is received for the current user", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🏝️", text: "On a tropical holiday" });
            await ownProfileStore.start();

            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🏡", text: "Back home" });
            client.emit(ClientEvent.UserProfileUpdate, client.getSafeUserId(), null);
            await new Promise(process.nextTick);

            expect(ownProfileStore.userStatus).toEqual({ emoji: "🏡", text: "Back home" });
        });

        it("should not update the user status when a UserProfileUpdate event is received for another user", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🏝️", text: "On a tropical holiday" });
            await ownProfileStore.start();

            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐭", text: "Is a mouse" });
            client.emit(ClientEvent.UserProfileUpdate, "@other:example.com", null);
            await new Promise(process.nextTick);

            expect(ownProfileStore.userStatus).toEqual({ emoji: "🏝️", text: "On a tropical holiday" });
        });
    });
});
