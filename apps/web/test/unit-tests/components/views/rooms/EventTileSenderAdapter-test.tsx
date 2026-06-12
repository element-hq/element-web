/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import SenderProfile from "../../../../../src/components/views/messages/SenderProfile";
import { EventTileSenderAdapter } from "../../../../../src/components/views/rooms/EventTile/EventTileSenderAdapter";
import { type MemberInfo } from "../../../../../src/viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";
import { type EventTileSenderSnapshot } from "../../../../../src/viewmodels/room/timeline/event-tile/EventTileViewModel";

jest.mock("../../../../../src/components/views/messages/SenderProfile", () =>
    jest.fn(() => <div data-testid="sender-profile" />),
);

function makeSenderSnapshot(overrides: Partial<EventTileSenderSnapshot> = {}): EventTileSenderSnapshot {
    return {
        senderId: "@alice:example.org",
        member: {
            userId: "@alice:example.org",
            roomId: "!room:example.org",
            rawDisplayName: "Alice",
            disambiguate: false,
        },
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

describe("EventTileSenderAdapter", () => {
    const mockedSenderProfile = mocked(SenderProfile);
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("passes clickable sender state to SenderProfile", () => {
        const onSenderProfileClick = jest.fn();
        const senderSnapshot = makeSenderSnapshot({ profileMode: "clickable" });
        const memberInfo: MemberInfo = senderSnapshot.member!;

        render(<EventTileSenderAdapter sender={senderSnapshot} onSenderProfileClick={onSenderProfileClick} />);

        expect(screen.getByTestId("sender-profile")).toBeInTheDocument();
        expect(mockedSenderProfile.mock.calls[0][0]).toMatchObject({
            senderId: "@alice:example.org",
            member: memberInfo,
            isEmote: false,
            onClick: onSenderProfileClick,
        });
    });

    it("enables tooltip rendering for tooltip mode", () => {
        const senderSnapshot = makeSenderSnapshot({ profileMode: "tooltip" });

        render(<EventTileSenderAdapter sender={senderSnapshot} onSenderProfileClick={jest.fn()} />);

        expect(screen.getByTestId("sender-profile")).toBeInTheDocument();
        expect(mockedSenderProfile.mock.calls[0][0]).toMatchObject({
            senderId: "@alice:example.org",
            isEmote: false,
            withTooltip: true,
        });
    });

    it("returns nothing when the sender should be hidden", () => {
        const senderSnapshot = makeSenderSnapshot({ profileMode: "hidden" });

        const { container } = render(
            <EventTileSenderAdapter sender={senderSnapshot} onSenderProfileClick={jest.fn()} />,
        );

        expect(container).toBeEmptyDOMElement();
        expect(mockedSenderProfile).not.toHaveBeenCalled();
    });
});
