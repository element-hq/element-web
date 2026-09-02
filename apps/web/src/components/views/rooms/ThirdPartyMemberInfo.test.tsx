/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { EventType, type IEvent, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { clientAndSDKContextRenderOptions, getMockClientWithEventEmitter, mockClientMethodsUser } from "test-utils";

import ThirdPartyMemberInfo from "./ThirdPartyMemberInfo";
import { SDKContextClass } from "../../../contexts/SDKContextClass.ts";

describe("<ThirdPartyMemberInfo />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: vi.fn(),
    });

    // make invite event with defaults
    const makeInviteEvent = (props: Partial<IEvent> = {}): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomThirdPartyInvite,
            state_key: "123456",
            sender: userId,
            room_id: roomId,
            content: {
                display_name: "bob@bob.com",
                key_validity_url: "https://isthiskeyvalid.org",
                public_key: "abc123",
            },
            ...props,
        });
    const defaultEvent = makeInviteEvent();

    const getComponent = (event: MatrixEvent = defaultEvent) =>
        render(
            <ThirdPartyMemberInfo event={event} />,
            clientAndSDKContextRenderOptions(mockClient, SDKContextClass.instance),
        );
    const room = new Room(roomId, mockClient, userId);
    const aliceMember = new RoomMember(roomId, userId);
    aliceMember.name = "Alice DisplayName";

    beforeEach(() => {
        vi.spyOn(room, "getMember").mockImplementation((id) => (id === userId ? aliceMember : null));
        mockClient.getRoom.mockClear().mockReturnValue(room);
    });

    it("should render invite", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("should render invite when room in not available", () => {
        const event = makeInviteEvent({ room_id: "not_available" });
        const { container } = getComponent(event);
        expect(container).toMatchSnapshot();
    });

    it("should use inviter's id when room member is not available", () => {
        const event = makeInviteEvent({ sender: "@charlie:server.org" });
        getComponent(event);

        expect(screen.getByText("Invited by @charlie:server.org")).toBeInTheDocument();
    });
});
