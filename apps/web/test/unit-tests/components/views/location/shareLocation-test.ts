/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import {
    ContentHelpers,
    type MatrixClient,
    type LegacyLocationEventContent,
    type MLocationEventContent,
} from "matrix-js-sdk/src/matrix";

import { doMaybeLocalRoomAction } from "../../../../../src/utils/local-room";
import {
    LocationShareType,
    shareLocation,
    type ShareLocationFn,
} from "../../../../../src/components/views/location/shareLocation";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { mkEvent } from "../../../../test-utils";

jest.mock("../../../../../src/utils/local-room", () => ({
    doMaybeLocalRoomAction: jest.fn(),
}));

describe("shareLocation", () => {
    const roomId = "!room:example.com";
    const shareType = LocationShareType.Pin;
    const content = { test: "location content" } as unknown as LegacyLocationEventContent & MLocationEventContent;
    let client: MatrixClient;
    let shareLocationFn: ShareLocationFn;

    beforeEach(() => {
        const makeLocationContent = jest.spyOn(ContentHelpers, "makeLocationContent");
        client = {
            sendMessage: jest.fn(),
            getSafeUserId: jest.fn().mockReturnValue("@alice:example.com"),
        } as unknown as MatrixClient;

        mocked(makeLocationContent).mockReturnValue(content);
        mocked(doMaybeLocalRoomAction).mockImplementation(
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

    describe("when replying to an event", () => {
        it("should send the location as a reply and clear the composer's reply state", () => {
            const replyContent = { test: "location content" } as unknown as LegacyLocationEventContent &
                MLocationEventContent;
            mocked(ContentHelpers.makeLocationContent).mockReturnValue(replyContent);
            const replyToEvent = mkEvent({
                event: true,
                type: "m.room.message",
                room: roomId,
                user: "@bob:example.com",
                content: { msgtype: "m.text", body: "where are you?" },
            });
            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

            shareLocation(
                client,
                roomId,
                shareType,
                undefined,
                () => {},
                replyToEvent,
                TimelineRenderingType.Room,
            )({ uri: "https://example.com/" });

            expect(client.sendMessage).toHaveBeenCalledWith(
                roomId,
                null,
                expect.objectContaining({
                    "m.relates_to": { "m.in_reply_to": { event_id: replyToEvent.getId() } },
                }),
            );
            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: null,
                context: TimelineRenderingType.Room,
            });
        });
    });
});
