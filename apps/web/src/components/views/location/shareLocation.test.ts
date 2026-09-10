/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    ContentHelpers,
    type MatrixClient,
    type LegacyLocationEventContent,
    type MLocationEventContent,
} from "matrix-js-sdk/src/matrix";

import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import { LocationShareType, shareLocation, type ShareLocationFn } from "./shareLocation";

vi.mock("../../../utils/local-room", () => ({
    doMaybeLocalRoomAction: vi.fn(),
}));

describe("shareLocation", () => {
    const roomId = "!room:example.com";
    const shareType = LocationShareType.Pin;
    const content = { test: "location content" } as unknown as LegacyLocationEventContent & MLocationEventContent;
    let client: MatrixClient;
    let shareLocationFn: ShareLocationFn;

    beforeEach(() => {
        const makeLocationContent = vi.spyOn(ContentHelpers, "makeLocationContent");
        client = {
            sendMessage: vi.fn(),
        } as unknown as MatrixClient;

        vi.mocked(makeLocationContent).mockReturnValue(content);
        vi.mocked(doMaybeLocalRoomAction).mockImplementation(
            <T>(roomId: string, fn: (actualRoomId: string) => Promise<T>, client?: MatrixClient) => {
                return fn(roomId);
            },
        );

        shareLocationFn = shareLocation(client, roomId, shareType, undefined, () => {});
    });

    it("should forward the call to doMaybeLocalRoomAction", () => {
        shareLocationFn({ uri: "https://example.com/" });
        expect(client.sendMessage).toHaveBeenCalledWith(roomId, null, content);
    });
});
