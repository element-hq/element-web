/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type MockedObject } from "jest-mock";
import { type MatrixClient, MatrixEvent, Preset, Room } from "matrix-js-sdk/src/matrix";
import { render, cleanup, screen, fireEvent, waitFor } from "jest-matrix-react";

import { stubClient, mockPlatformPeg, unmockPlatformPeg, withClientContextRenderOptions } from "../../../test-utils";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import SpaceRoomView from "../../../../src/components/structures/SpaceRoomView.tsx";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier.ts";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks.ts";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore.ts";
import DMRoomMap from "../../../../src/utils/DMRoomMap.ts";
import { IOpts } from "../../../../src/createRoom.ts";

describe("SpaceRoomView", () => {
    let cli: MockedObject<MatrixClient>;
    let space: Room;

    beforeEach(() => {
        mockPlatformPeg({ reload: () => {} });
        cli = mocked(stubClient());

        space = new Room(`!space:example.org`, cli, cli.getSafeUserId());
        space.currentState.setStateEvents([
            new MatrixEvent({
                type: "m.room.create",
                room_id: space.roomId,
                sender: cli.getSafeUserId(),
                state_key: "",
                content: {
                    creator: cli.getSafeUserId(),
                    type: "m.space",
                },
            }),
            new MatrixEvent({
                type: "m.room.member",
                room_id: space.roomId,
                sender: cli.getSafeUserId(),
                state_key: cli.getSafeUserId(),
                content: {
                    membership: "join",
                },
            }),
            new MatrixEvent({
                type: "m.room.member",
                room_id: space.roomId,
                sender: "@userA:server",
                state_key: "@userA:server",
                content: {
                    membership: "join",
                },
            }),
            new MatrixEvent({
                type: "m.room.member",
                room_id: space.roomId,
                sender: "@userB:server",
                state_key: "@userB:server",
                content: {
                    membership: "join",
                },
            }),
            new MatrixEvent({
                type: "m.room.member",
                room_id: space.roomId,
                sender: "@userC:server",
                state_key: "@userC:server",
                content: {
                    membership: "join",
                },
            }),
        ]);
        space.updateMyMembership("join");

        DMRoomMap.makeShared(cli);
    });

    afterEach(() => {
        unmockPlatformPeg();
        jest.clearAllMocks();
        cleanup();
    });

    const renderSpaceRoomView = async (justCreatedOpts?: IOpts): Promise<ReturnType<typeof render>> => {
        const resizeNotifier = new ResizeNotifier();
        const permalinkCreator = new RoomPermalinkCreator(space);

        const spaceRoomView = render(
            <SpaceRoomView
                space={space}
                resizeNotifier={resizeNotifier}
                permalinkCreator={permalinkCreator}
                onJoinButtonClicked={jest.fn()}
                onRejectButtonClicked={jest.fn()}
                justCreatedOpts={justCreatedOpts}
            />,
            withClientContextRenderOptions(cli),
        );
        return spaceRoomView;
    };

    describe("SpaceLanding", () => {
        it("should show member list right panel phase on members click on landing", async () => {
            const spy = jest.spyOn(RightPanelStore.instance, "setCard");
            const { container } = await renderSpaceRoomView();

            await expect(screen.findByText("Welcome to")).resolves.toBeVisible();
            fireEvent.click(container.querySelector(".mx_FacePile")!);

            expect(spy).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList });
        });
    });

    describe("SpaceSetupFirstRooms", () => {
        beforeEach(async () => {
            await renderSpaceRoomView({
                createOpts: { preset: Preset.PublicChat },
            });
        });

        it("renders SpaceSetupFirstRooms with correct title and description", () => {
            expect(
                screen.getByText("What are some things you want to discuss in !space:example.org?"),
            ).toBeInTheDocument();
            // using regex here since there's a stray <br />
            expect(screen.getByText(/let's create a room for each of them/i)).toBeInTheDocument();
            expect(
                screen.getByText(/you can add more later too, including already existing ones/i),
            ).toBeInTheDocument();
        });

        it("renders three input fields with correct placeholders", () => {
            expect(screen.getAllByPlaceholderText(/general/i)).toHaveLength(1);
            expect(screen.getAllByPlaceholderText(/random/i)).toHaveLength(1);
            expect(screen.getAllByPlaceholderText(/support/i)).toHaveLength(1);
        });

        it("updates input value when typed", () => {
            const input = screen.getAllByRole("textbox")[0];
            fireEvent.change(input, { target: { value: "My Room" } });
            expect(input).toHaveValue("My Room");
        });

        it("shows 'Skip for now' when all fields are empty, 'Continue' when any field is filled", () => {
            // Clear all fields first
            screen.getAllByRole("textbox").forEach((input) => fireEvent.change(input, { target: { value: "" } }));

            // Should say 'Skip for now'
            const button = screen.getByRole("button");
            expect(button).toHaveValue("Skip for now");

            // Fill a field
            fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Room" } });
            expect(button).toHaveValue("Continue");
        });

        it("calls onFinished with no argument when skipping", () => {
            const button = screen.getByRole("button");
            fireEvent.click(button);
            // Since onFinished is handled internally, check that SpaceSetupFirstRooms is no longer rendered
            expect(screen.queryByText(/setup_rooms_community_heading/i)).not.toBeInTheDocument();
        });

        it("calls createRoom for each non-empty field and onFinished with first room id", async () => {
            cli.createRoom.mockResolvedValueOnce({ room_id: "room1" }).mockResolvedValueOnce({ room_id: "room2" });

            fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Room A" } });
            fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Room B" } });
            fireEvent.click(screen.getByRole("button"));

            await waitFor(() => {
                expect(cli.createRoom).toHaveBeenCalledTimes(2);
            });
            // After finishing, SpaceSetupFirstRooms should not be rendered
            expect(screen.queryByText(/setup_rooms_community_heading/i)).not.toBeInTheDocument();
        });

        it("shows error message if room creation fails", async () => {
            // Force failure.
            cli.createRoom.mockRejectedValue(new Error("fail"));

            // Create a room.
            fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Room A" } });
            fireEvent.click(screen.getByRole("button"));

            await waitFor(() => {
                expect(
                    screen.getByText((content) =>
                        content.toLowerCase().includes("failed to create initial space rooms"),
                    ),
                ).toBeInTheDocument();
            });
        });

        it("disables button and shows 'Creating rooms' while busy", async () => {
            cli.createRoom.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        /* intentionally unresolved to mock work by the server */
                    }),
            );

            fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Room A" } });
            fireEvent.click(screen.getByRole("button"));

            const button = screen.getByRole("button");
            expect(button).toBeDisabled();
            expect(button).toHaveValue("Creating rooms…"); // Note the ellipsis
        });
    });
});
