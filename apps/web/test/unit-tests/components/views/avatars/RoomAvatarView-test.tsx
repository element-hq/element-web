/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { RoomAvatarView } from "../../../../../src/components/views/avatars/RoomAvatarView";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import {
    AvatarBadgeDecoration,
    type RoomAvatarViewState,
    useRoomAvatarViewModel,
} from "../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { Presence } from "../../../../../src/components/views/avatars/WithPresenceIndicator";

jest.mock("../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel", () => ({
    ...jest.requireActual("../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel"),
    useRoomAvatarViewModel: jest.fn(),
}));

describe("<RoomAvatarView />", () => {
    const matrixClient = stubClient();
    const room = mkStubRoom("roomId", "roomName", matrixClient);

    DMRoomMap.makeShared(matrixClient);
    jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(undefined);

    let defaultValue: RoomAvatarViewState;

    beforeEach(() => {
        defaultValue = {
            badgeDecoration: undefined,
            presence: null,
        };

        mocked(useRoomAvatarViewModel).mockReturnValue(defaultValue);
    });

    it("should not render a decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({ ...defaultValue });
        const { asFragment } = render(<RoomAvatarView room={room} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a low priority room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.LowPriority,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This is a low priority room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a video room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.VideoRoom,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is a video room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a public room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.PublicRoom,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is public")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it.each([
        { presence: Presence.Online, label: "Online" },
        { presence: Presence.Offline, label: "Offline" },
        { presence: Presence.Busy, label: "Busy" },
        { presence: Presence.Away, label: "Away" },
    ])("should render the $presence presence", ({ presence, label }) => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.Presence,
            presence,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText(label)).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("badge tooltip gating", () => {
        const LABEL = "This room is public";

        // A mounted tooltip renders its label as text; unmounted, the label survives only as the
        // decoration's own accessible name.
        const tooltip = (): HTMLElement | null => screen.queryByText(LABEL);
        const decoration = (): HTMLElement => screen.getByLabelText(LABEL);
        const avatar = (): HTMLElement => decoration().parentElement!;

        // Captured before anything spies on it, so that repeated calls do not stack mocks.
        const realMatchMedia = window.matchMedia;
        let matchMediaSpy: jest.SpyInstance | undefined;

        function setHoverCapability(canHover: boolean): void {
            matchMediaSpy = jest
                .spyOn(window, "matchMedia")
                .mockImplementation((query) => ({ ...realMatchMedia(query), matches: canHover }) as MediaQueryList);
        }

        beforeEach(() => {
            mocked(useRoomAvatarViewModel).mockReturnValue({
                ...defaultValue,
                badgeDecoration: AvatarBadgeDecoration.PublicRoom,
            });
            setHoverCapability(true);
        });

        afterEach(() => matchMediaSpy?.mockRestore());

        it("should name the decoration while the tooltip is unmounted", () => {
            render(<RoomAvatarView room={room} />);

            expect(decoration()).toBeInTheDocument();
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should mount the tooltip while the pointer is over the avatar", () => {
            render(<RoomAvatarView room={room} />);

            fireEvent.mouseMove(avatar());
            expect(tooltip()).toBeInTheDocument();

            fireEvent.mouseLeave(avatar());
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should ignore an enter without movement, which a scrolling list fires per row", () => {
            render(<RoomAvatarView room={room} />);

            fireEvent.mouseEnter(avatar());
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should keep the tooltip mounted where the pointer cannot hover", () => {
            // Touch reaches the tooltip by long press, which Compound handles on the tooltip's own
            // anchor, so a tooltip that mounts on hover would never be reachable at all.
            setHoverCapability(false);
            render(<RoomAvatarView room={room} />);

            expect(tooltip()).toBeInTheDocument();
        });
    });
});
