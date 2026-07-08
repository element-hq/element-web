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
import { clientAndSDKContextRenderOptions, stubClient, useMockedCalls } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { TestSDKContext } from "../../../TestSDKContext.ts";

const FAKE_AVATAR_URL = "http://fakeurl.dummy/fake.png";

describe("VideoFeed", () => {
    useMockedCalls();

    let client: MatrixClient;
    let sdkContext: TestSDKContext;

    beforeAll(() => {
        client = stubClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        (AvatarModule as any).avatarUrlForRoom = jest.fn().mockReturnValue(FAKE_AVATAR_URL);

        const dmRoomMap = new DMRoomMap(client);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Displays the room avatar when no video is available", () => {
        jest.spyOn(sdkContext.legacyCallHandler, "roomIdForCall").mockReturnValue("!this:room.here");

        const mockCall = {
            room: new Room("!room:example.com", client, client.getSafeUserId()),
        };

        const feed = {
            isAudioMuted: jest.fn().mockReturnValue(false),
            isVideoMuted: jest.fn().mockReturnValue(true),
            addListener: jest.fn(),
            removeListener: jest.fn(),
        };
        render(
            <VideoFeed feed={feed as unknown as CallFeed} call={mockCall as unknown as MatrixCall} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const avatarImg = screen.getByRole("presentation");
        expect(avatarImg).toHaveAttribute("src", FAKE_AVATAR_URL);
    });
});
