/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import MemberAvatar from "../../../../../src/components/views/avatars/MemberAvatar";
import { EventTileAvatarAdapter } from "../../../../../src/components/views/rooms/EventTile/EventTileAvatarAdapter";
import { type EventTileSenderSnapshot } from "../../../../../src/viewmodels/room/timeline/event-tile/EventTileViewModel";

jest.mock("../../../../../src/components/views/avatars/MemberAvatar", () =>
    jest.fn(() => <div data-testid="member-avatar" />),
);

describe("EventTileAvatarAdapter", () => {
    const mockedMemberAvatar = mocked(MemberAvatar);

    function makeSenderSnapshot(overrides: Partial<EventTileSenderSnapshot> = {}): EventTileSenderSnapshot {
        return {
            senderId: "@alice:example.org",
            viewUserOnClick: true,
            profileMode: "clickable",
            forceHistoricalAvatar: false,
            isEmote: false,
            ...overrides,
            profileState: {
                avatarSize: "30px",
                needsSenderProfile: true,
                ...overrides.profileState,
            },
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("passes render data through to MemberAvatar", () => {
        const avatarMember = new RoomMember("!room:example.org", "@alice:example.org");
        const senderSnapshot = makeSenderSnapshot({
            profileState: {
                avatarSize: "24px",
                needsSenderProfile: true,
            },
            viewUserOnClick: false,
            forceHistoricalAvatar: true,
        });

        const { container } = render(
            <EventTileAvatarAdapter avatarMember={avatarMember} senderSnapshot={senderSnapshot} />,
        );

        expect(container.querySelector(".mx_EventTile_avatar")).not.toBeNull();
        expect(mockedMemberAvatar.mock.calls[0][0]).toMatchObject({
            member: avatarMember,
            size: "24px",
            viewUserOnClick: false,
            forceHistorical: true,
        });
    });

    it("renders nothing when the avatar is not available", () => {
        const { container } = render(
            <EventTileAvatarAdapter avatarMember={null} senderSnapshot={makeSenderSnapshot()} />,
        );

        expect(container.querySelector(".mx_EventTile_avatar")).toBeNull();
        expect(mockedMemberAvatar).not.toHaveBeenCalled();
    });
});
