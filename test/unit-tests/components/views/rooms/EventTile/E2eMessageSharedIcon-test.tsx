/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import { mocked } from "jest-mock";
import { type RoomMember, type RoomState } from "matrix-js-sdk/src/matrix";

import { E2eMessageSharedIcon } from "../../../../../../src/components/views/rooms/EventTile/E2eMessageSharedIcon.tsx";
import { createTestClient, mkStubRoom, withClientContextRenderOptions } from "../../../../../test-utils";

describe("E2eMessageSharedIcon", () => {
    it("renders correctly for a known user", () => {
        const mockClient = createTestClient();
        const mockMember = { rawDisplayName: "Bob" } as RoomMember;
        const mockState = {
            getMember: (userId) => {
                expect(userId).toEqual("@bob:example.com");
                return mockMember;
            },
        } as RoomState;
        const mockRoom = mkStubRoom("!roomId", undefined, mockClient, mockState);
        mocked(mockClient.getRoom).mockImplementation((roomId) => {
            expect(roomId).toEqual("!roomId");
            return mockRoom;
        });

        const result = render(
            <E2eMessageSharedIcon keyForwardingUserId="@bob:example.com" roomId="!roomId" />,
            withClientContextRenderOptions(mockClient),
        );

        expect(result.container).toMatchSnapshot();
        expect(result.container.firstChild).toHaveAccessibleName(
            "Bob (@bob:example.com) shared this message since you were not in the room when it was sent.",
        );
    });

    it("renders correctly for an unknown user", () => {
        const mockClient = createTestClient();
        const result = render(
            <E2eMessageSharedIcon keyForwardingUserId="@bob:example.com" roomId="!roomId" />,
            withClientContextRenderOptions(mockClient),
        );

        expect(result.container).toMatchSnapshot();
        expect(result.container.firstChild).toHaveAccessibleName(
            "@bob:example.com (@bob:example.com) shared this message since you were not in the room when it was sent.",
        );
    });
});
