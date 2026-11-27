/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "test-utils-rtl";
import { mkStubRoom, stubClient } from "test-utils";

import { DecoratedRoomAvatarView } from "./DecoratedRoomAvatarView";
import {
    AvatarBadgeDecoration,
    type RoomAvatarViewState,
    useRoomAvatarViewModel,
} from "../../viewmodels/avatars/RoomAvatarViewModel";
import DMRoomMap from "../../../utils/DMRoomMap";
import { Presence } from "./WithPresenceIndicator";

vi.mock("../../viewmodels/avatars/RoomAvatarViewModel", async () => ({
    ...(await vi.importActual("../../viewmodels/avatars/RoomAvatarViewModel")),
    useRoomAvatarViewModel: vi.fn(),
}));

describe("<DecoratedRoomAvatarView />", () => {
    const matrixClient = stubClient();
    const room = mkStubRoom("roomId", "roomName", matrixClient);

    DMRoomMap.makeShared(matrixClient);
    vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(undefined);

    let defaultValue: RoomAvatarViewState;

    beforeEach(() => {
        defaultValue = {
            badgeDecoration: undefined,
            presence: null,
        };

        vi.mocked(useRoomAvatarViewModel).mockReturnValue(defaultValue);
    });

    it("should not render a decoration", () => {
        vi.mocked(useRoomAvatarViewModel).mockReturnValue({ ...defaultValue });
        const { asFragment } = render(<DecoratedRoomAvatarView room={room} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a low priority room decoration", () => {
        vi.mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.LowPriority,
        });
        const { asFragment } = render(<DecoratedRoomAvatarView room={room} />);

        expect(screen.getByLabelText("This is a low priority room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a video room decoration", () => {
        vi.mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.VideoRoom,
        });
        const { asFragment } = render(<DecoratedRoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is a video room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a public room decoration", () => {
        vi.mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.PublicRoom,
        });
        const { asFragment } = render(<DecoratedRoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is public")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it.each([
        { presence: Presence.Online, label: "Online" },
        { presence: Presence.Offline, label: "Offline" },
        { presence: Presence.Busy, label: "Busy" },
        { presence: Presence.Away, label: "Away" },
    ])("should render the $presence presence", ({ presence, label }) => {
        vi.mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            badgeDecoration: AvatarBadgeDecoration.Presence,
            presence,
        });
        const { asFragment } = render(<DecoratedRoomAvatarView room={room} />);

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

        const matchMedia = window.matchMedia.bind(window);

        function setHoverCapability(canHover: boolean): void {
            vi.spyOn(window, "matchMedia").mockImplementation((query) => {
                const result = matchMedia(query);
                if (query === "(hover: hover)") {
                    Object.defineProperty(result, "matches", { value: canHover });
                }
                return result;
            });
        }

        beforeEach(() => {
            vi.mocked(useRoomAvatarViewModel).mockReturnValue({
                ...defaultValue,
                badgeDecoration: AvatarBadgeDecoration.PublicRoom,
            });
            setHoverCapability(true);
        });

        afterEach(() => vi.mocked(window.matchMedia).mockRestore());

        it("should name the decoration while the tooltip is unmounted", () => {
            render(<DecoratedRoomAvatarView room={room} />);

            expect(decoration()).toBeInTheDocument();
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should mount the tooltip while the pointer is over the avatar", () => {
            render(<DecoratedRoomAvatarView room={room} />);

            fireEvent.mouseMove(avatar());
            expect(tooltip()).toBeInTheDocument();

            fireEvent.mouseLeave(avatar());
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should ignore an enter without movement, which a scrolling list fires per row", () => {
            render(<DecoratedRoomAvatarView room={room} />);

            fireEvent.mouseEnter(avatar());
            expect(tooltip()).not.toBeInTheDocument();
        });

        it("should keep the tooltip mounted where the pointer cannot hover", () => {
            // Touch reaches the tooltip by long press, which Compound handles on the tooltip's own
            // anchor, so a tooltip that mounts on hover would never be reachable at all.
            setHoverCapability(false);
            render(<DecoratedRoomAvatarView room={room} />);

            expect(tooltip()).toBeInTheDocument();
        });
    });
});
