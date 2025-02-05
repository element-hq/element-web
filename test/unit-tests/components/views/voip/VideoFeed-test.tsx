/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import * as AvatarModule from "../../../../../src/Avatar";
import VideoFeed from "../../../../../src/components/views/voip/VideoFeed";
import { stubClient, useMockedCalls } from "../../../../test-utils";
import type LegacyCallHandler from "../../../../../src/LegacyCallHandler";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

const FAKE_AVATAR_URL = "http://fakeurl.dummy/fake.png";

describe("VideoFeed", () => {
    useMockedCalls();

    let client: MatrixClient;

    beforeAll(() => {
        client = stubClient();
        (AvatarModule as any).avatarUrlForRoom = jest.fn().mockReturnValue(FAKE_AVATAR_URL);

        const dmRoomMap = new DMRoomMap(client);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Displays the room avatar when no video is available", () => {
        window.mxLegacyCallHandler = {
            roomIdForCall: jest.fn().mockReturnValue("!this:room.here"),
        } as unknown as LegacyCallHandler;

        const mockCall = {
            room: new Room("!room:example.com", client, client.getSafeUserId()),
        };

        const feed = {
            isAudioMuted: jest.fn().mockReturnValue(false),
            isVideoMuted: jest.fn().mockReturnValue(true),
            addListener: jest.fn(),
            removeListener: jest.fn(),
        };
        render(<VideoFeed feed={feed as unknown as CallFeed} call={mockCall as unknown as MatrixCall} />);
        const avatarImg = screen.getByRole("presentation");
        expect(avatarImg).toHaveAttribute("src", FAKE_AVATAR_URL);
    });
});
