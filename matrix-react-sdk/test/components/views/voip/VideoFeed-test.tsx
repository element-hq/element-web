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

import React from "react";
import { render, screen } from "@testing-library/react";
import { CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";

import * as AvatarModule from "../../../../src/Avatar";
import VideoFeed from "../../../../src/components/views/voip/VideoFeed";
import { stubClient, useMockedCalls } from "../../../test-utils";
import LegacyCallHandler from "../../../../src/LegacyCallHandler";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

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
        const avatarImg = screen.getByRole("img");
        expect(avatarImg).toHaveAttribute("src", FAKE_AVATAR_URL);
    });
});
