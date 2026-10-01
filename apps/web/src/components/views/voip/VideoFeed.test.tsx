/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen } from "test-utils-rtl";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { clientAndSDKContextRenderOptions, stubClient, useMockedCalls, TestSDKContext } from "test-utils";

import * as AvatarModule from "../../../Avatar";
import VideoFeed from "./VideoFeed";
import DMRoomMap from "../../../utils/DMRoomMap";

const FAKE_AVATAR_URL = "http://fakeurl.dummy/fake.png";

describe("VideoFeed", () => {
    useMockedCalls();

    let client: MatrixClient;
    let sdkContext: TestSDKContext;

    beforeAll(() => {
        client = stubClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        vi.spyOn(AvatarModule, "avatarUrlForRoom").mockReturnValue(FAKE_AVATAR_URL);

        const dmRoomMap = new DMRoomMap(client);
        vi.spyOn(dmRoomMap, "getUserIdForRoomId");
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it("Displays the room avatar when no video is available", () => {
        vi.spyOn(sdkContext.legacyCallHandler, "roomIdForCall").mockReturnValue("!this:room.here");

        const mockCall = {
            room: new Room("!room:example.com", client, client.getSafeUserId()),
        };

        const feed = {
            isAudioMuted: vi.fn().mockReturnValue(false),
            isVideoMuted: vi.fn().mockReturnValue(true),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        };
        render(
            <VideoFeed feed={feed as unknown as CallFeed} call={mockCall as unknown as MatrixCall} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const avatarImg = screen.getByRole("presentation");
        expect(avatarImg).toHaveAttribute("src", FAKE_AVATAR_URL);
    });
});
