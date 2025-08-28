/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import { mkRoom, stubClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { RoomListItemView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListItemView";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import {
    type RoomListItemViewState,
    useRoomListItemViewModel,
} from "../../../../../../src/components/viewmodels/roomlist/RoomListItemViewModel";
import { RoomNotificationState } from "../../../../../../src/stores/notifications/RoomNotificationState";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListItemViewModel", () => ({
    useRoomListItemViewModel: jest.fn(),
}));

describe("<RoomListItemView />", () => {
    let defaultValue: RoomListItemViewState;
    let matrixClient: MatrixClient;
    let room: Room;

    const renderRoomListItem = (props: Partial<React.ComponentProps<typeof RoomListItemView>> = {}) => {
        const defaultProps = {
            room,
            isSelected: false,
            isFocused: false,
            onFocus: jest.fn(),
            roomIndex: 0,
            roomCount: 1,
            listIsScrolling: false,
        };

        return render(<RoomListItemView {...defaultProps} {...props} />, withClientContextRenderOptions(matrixClient));
    };

    beforeEach(() => {
        matrixClient = stubClient();
        room = mkRoom(matrixClient, "room1");

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);

        const notificationState = new RoomNotificationState(room, false);
        jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
        jest.spyOn(notificationState, "isNotification", "get").mockReturnValue(true);
        jest.spyOn(notificationState, "count", "get").mockReturnValue(1);

        defaultValue = {
            openRoom: jest.fn(),
            showContextMenu: false,
            showHoverMenu: false,
            notificationState,
            a11yLabel: "Open room room1",
            isBold: false,
            isVideoRoom: false,
            callConnectionState: null,
            hasParticipantInCall: false,
            name: room.name,
            showNotificationDecoration: false,
            messagePreview: undefined,
        };

        mocked(useRoomListItemViewModel).mockReturnValue(defaultValue);
    });

    test("should render a room item", () => {
        const onClick = jest.fn();
        const { asFragment } = renderRoomListItem({
            onClick,
            roomCount: 0,
        });
        expect(asFragment()).toMatchSnapshot();
    });

    test("should render a room item with a message preview", () => {
        defaultValue.messagePreview = "The message looks like this";

        const onClick = jest.fn();
        const { asFragment } = renderRoomListItem({
            onClick,
        });
        expect(asFragment()).toMatchSnapshot();
    });

    test("should call openRoom when clicked", async () => {
        const user = userEvent.setup();
        renderRoomListItem();

        await user.click(screen.getByRole("option", { name: `Open room ${room.name}` }));
        expect(defaultValue.openRoom).toHaveBeenCalled();
    });

    test("should hover decoration if hovered", async () => {
        mocked(useRoomListItemViewModel).mockReturnValue({ ...defaultValue, showHoverMenu: true });

        const user = userEvent.setup();
        renderRoomListItem();

        const listItem = screen.getByRole("option", { name: `Open room ${room.name}` });
        expect(screen.queryByRole("button", { name: "More Options" })).toBeNull();

        await user.hover(listItem);
        await waitFor(() => expect(screen.getByRole("button", { name: "More Options" })).toBeInTheDocument());
    });

    test("should hover decoration if focused", async () => {
        const { rerender } = renderRoomListItem({
            isFocused: true,
        });

        const listItem = screen.getByRole("option", { name: `Open room ${room.name}` });
        expect(listItem).toHaveClass("flex mx_RoomListItemView mx_RoomListItemView_hover");

        rerender(
            <RoomListItemView
                room={room}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={1}
                listIsScrolling={false}
            />,
        );

        await waitFor(() => expect(listItem).not.toHaveClass("flex mx_RoomListItemView mx_RoomListItemView_hover"));
    });

    test("should be selected if isSelected=true", async () => {
        const { asFragment } = renderRoomListItem({
            isSelected: true,
        });

        expect(screen.queryByRole("option", { name: `Open room ${room.name}` })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(asFragment()).toMatchSnapshot();
    });

    test("should display notification decoration", async () => {
        mocked(useRoomListItemViewModel).mockReturnValue({
            ...defaultValue,
            showNotificationDecoration: true,
        });

        const { asFragment } = renderRoomListItem();

        expect(screen.getByTestId("notification-decoration")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    test("should not display notification decoration when hovered", async () => {
        const user = userEvent.setup();

        mocked(useRoomListItemViewModel).mockReturnValue({
            ...defaultValue,
            showNotificationDecoration: true,
        });

        renderRoomListItem();

        const listItem = screen.getByRole("option", { name: `Open room ${room.name}` });
        await user.hover(listItem);

        expect(screen.queryByRole("notification-decoration")).toBeNull();
    });

    test("should render the context menu", async () => {
        const user = userEvent.setup();

        mocked(useRoomListItemViewModel).mockReturnValue({
            ...defaultValue,
            showContextMenu: true,
        });

        renderRoomListItem();

        const button = screen.getByRole("option", { name: `Open room ${room.name}` });
        await user.pointer([{ target: button }, { keys: "[MouseRight]", target: button }]);
        await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
        // Menu should close
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("menu")).toBeNull();
    });

    test("should not render context menu when list is scrolling", async () => {
        const user = userEvent.setup();

        mocked(useRoomListItemViewModel).mockReturnValue({
            ...defaultValue,
            showContextMenu: true,
        });

        renderRoomListItem({
            listIsScrolling: true,
        });

        const button = screen.getByRole("option", { name: `Open room ${room.name}` });
        await user.pointer([{ target: button }, { keys: "[MouseRight]", target: button }]);

        // Context menu should not appear when scrolling
        expect(screen.queryByRole("menu")).toBeNull();

        // But the room item itself should still be rendered
        expect(button).toBeInTheDocument();
    });
});
