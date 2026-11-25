/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "test-utils-rtl";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import MemberAvatar from "../../avatars/MemberAvatar";
import { EventTileAvatarAdapter } from "./EventTileAvatarAdapter";
import { type EventTileSenderSnapshot } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

vi.mock("../../avatars/MemberAvatar", () => ({
    default: vi.fn(() => <div data-testid="member-avatar" />),
}));

function makeSenderSnapshot(overrides: Partial<EventTileSenderSnapshot> = {}): EventTileSenderSnapshot {
    return {
        senderId: "@alice:example.org",
        member: null,
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

describe("EventTileAvatarAdapter", () => {
    const mockedMemberAvatar = vi.mocked(MemberAvatar);

    beforeEach(() => {
        vi.clearAllMocks();
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

        expect(container.querySelector('[data-testid="member-avatar"]')).not.toBeNull();
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

        expect(container.querySelector('[data-testid="member-avatar"]')).toBeNull();
        expect(mockedMemberAvatar).not.toHaveBeenCalled();
    });
});
