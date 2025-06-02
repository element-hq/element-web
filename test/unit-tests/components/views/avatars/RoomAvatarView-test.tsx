/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { RoomAvatarView } from "../../../../../src/components/views/avatars/RoomAvatarView";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import {
    type RoomAvatarViewState,
    useRoomAvatarViewModel,
} from "../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { Presence } from "../../../../../src/components/views/avatars/WithPresenceIndicator";

jest.mock("../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel", () => ({
    useRoomAvatarViewModel: jest.fn(),
}));

describe("<RoomAvatarView />", () => {
    const matrixClient = stubClient();
    const room = mkStubRoom("roomId", "roomName", matrixClient);

    DMRoomMap.makeShared(matrixClient);
    jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);

    let defaultValue: RoomAvatarViewState;

    beforeEach(() => {
        defaultValue = {
            hasDecoration: true,
            isPublic: false,
            isVideoRoom: false,
            isLowPriority: false,
            presence: null,
        };

        mocked(useRoomAvatarViewModel).mockReturnValue(defaultValue);
    });

    it("should not render a decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({ ...defaultValue, hasDecoration: false });
        const { asFragment } = render(<RoomAvatarView room={room} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a low priority room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({ ...defaultValue, hasDecoration: true, isLowPriority: true });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This is a low priority room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a video room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({ ...defaultValue, hasDecoration: true, isVideoRoom: true });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is a video room")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a public room decoration", () => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            hasDecoration: true,
            isPublic: true,
            isVideoRoom: false,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText("This room is public")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render icon depending on precedence", () => {
        // Precedence is Low priority > Video room > Public room > Presence

        const mockVM = {
            ...defaultValue,
            hasDecoration: true,
            presence: Presence.Online,
        };
        mocked(useRoomAvatarViewModel).mockReturnValue(mockVM);

        // 1. Presence has the least priority
        const { rerender } = render(<RoomAvatarView room={room} />);
        expect(screen.queryByLabelText("Online")).toBeInTheDocument();

        // 2. With presence and public room, presence takes precedence
        mockVM.isPublic = true;
        rerender(<RoomAvatarView room={room} />);
        expect(screen.queryByLabelText("This room is public")).toBeInTheDocument();
        expect(screen.queryByLabelText("Online")).not.toBeInTheDocument();

        // 3. With presence, public-room and video room, video room takes precedence
        mockVM.isVideoRoom = true;
        rerender(<RoomAvatarView room={room} />);
        expect(screen.queryByLabelText("This room is a video room")).toBeInTheDocument();
        expect(screen.queryByLabelText("This room is public")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Online")).not.toBeInTheDocument();

        // 4. With presence, public room, video room and low priority, low priority takes precedence
        mockVM.isLowPriority = true;
        rerender(<RoomAvatarView room={room} />);
        expect(screen.queryByLabelText("This is a low priority room")).toBeInTheDocument();
        expect(screen.queryByLabelText("This room is a video room")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("This room is public")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Online")).not.toBeInTheDocument();
    });

    it.each([
        { presence: Presence.Online, label: "Online" },
        { presence: Presence.Offline, label: "Offline" },
        { presence: Presence.Busy, label: "Busy" },
        { presence: Presence.Away, label: "Away" },
    ])("should render the $presence presence", ({ presence, label }) => {
        mocked(useRoomAvatarViewModel).mockReturnValue({
            ...defaultValue,
            hasDecoration: true,
            presence,
        });
        const { asFragment } = render(<RoomAvatarView room={room} />);

        expect(screen.getByLabelText(label)).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });
});
