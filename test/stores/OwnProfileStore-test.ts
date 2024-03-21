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

import { MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { MockedObject, mocked } from "jest-mock";

import { stubClient } from "../test-utils";
import { OwnProfileStore } from "../../src/stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../src/stores/AsyncStore";

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
        } catch (ignore) {}

        expect(onUpdate).not.toHaveBeenCalled();
        expect(ownProfileStore.displayName).toBe(client.getSafeUserId());
        expect(ownProfileStore.avatarMxc).toBeNull();
    });
});
