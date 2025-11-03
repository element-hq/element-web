/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type MockedObject } from "jest-mock";
import { type MatrixClient, MatrixEvent, Preset, Room } from "matrix-js-sdk/src/matrix";
import { render, cleanup, screen, fireEvent, waitFor, act } from "jest-matrix-react";

import { stubClient, mockPlatformPeg, unmockPlatformPeg, withClientContextRenderOptions } from "../../../test-utils";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import SpaceRoomView from "../../../../src/components/structures/SpaceRoomView.tsx";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier.ts";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks.ts";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore.ts";
import DMRoomMap from "../../../../src/utils/DMRoomMap.ts";
import { type IOpts } from "../../../../src/createRoom.ts";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore.ts";

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

        it("shows SpaceLandingAddButton context menu when Add button is clicked", async () => {
            await renderSpaceRoomView();
            await expect(screen.findByText("Welcome to")).resolves.toBeVisible();

            const addButton = screen.getByRole("button", { name: /add/i });
            fireEvent.click(addButton);

            expect(await screen.findByText(/new room/i)).toBeInTheDocument();
            expect(screen.getByText(/add existing room/i)).toBeInTheDocument();
        });
    });

    describe("Spaces: creating a new community space", () => {
        it("asks what topics you want to discuss, creates rooms for them and offers to share", async () => {
            cli.createRoom.mockResolvedValueOnce({ room_id: "room1" }).mockResolvedValueOnce({ room_id: "room2" });
            SpaceStore.instance.addRoomToSpace = jest.fn();

            // Given we are creating a space
            const view = await renderSpaceRoomView({
                createOpts: { preset: Preset.PublicChat },
                name: "My MySpace Space",
            });

            // Then we are asked what topics we want
            expect(
                view.getByRole("heading", { name: "What are some things you want to discuss in My MySpace Space?" }),
            ).toBeInTheDocument();

            // And some defaults are suggested
            expect(view.getByPlaceholderText(/general/i)).toBeInTheDocument();
            expect(view.getByPlaceholderText(/random/i)).toBeInTheDocument();
            expect(view.getByPlaceholderText(/support/i)).toBeInTheDocument();

            // When we enter some room names
            const input1 = view.getAllByRole("textbox")[0];
            const input2 = view.getAllByRole("textbox")[1];
            fireEvent.change(input1, { target: { value: "Room 1" } });
            fireEvent.change(input2, { target: { value: "Room 2" } });

            // And click "Continue"
            const button = view.getByRole("button", { name: "Continue" });
            fireEvent.click(button);

            // Then we create 2 rooms
            await waitFor(() => {
                expect(cli.createRoom).toHaveBeenCalledTimes(2);
            });

            // And offer the user to share this space
            await waitFor(() =>
                expect(view.getByRole("heading", { name: "Share My MySpace Space" })).toBeInTheDocument(),
            );
            expect(view.getByRole("button", { name: /Share invite link/ })).toBeInTheDocument();

            // And allow them to continue to the first room
            expect(view.getByRole("button", { name: "Go to my first room" })).toBeInTheDocument();
        });

        it("shows 'Skip for now' when all fields are empty, 'Continue' when any field is filled", async () => {
            // Given we are creating a space
            const view = await renderSpaceRoomView({
                createOpts: { preset: Preset.PublicChat },
            });

            // When we clear all the topics
            view.getAllByRole("textbox").forEach((input) => fireEvent.change(input, { target: { value: "" } }));

            // Then the button reads "Skip for now"
            expect(view.getByRole("button", { name: "Skip for now" })).toBeVisible();

            // But when we enter a topic
            fireEvent.change(view.getAllByRole("textbox")[0], { target: { value: "Room" } });

            // Then the button says "Continue"
            expect(view.getByRole("button", { name: "Continue" })).toBeVisible();
        });

        it("shows error message if room creation fails", async () => {
            // Given we are creating a space
            const view = await renderSpaceRoomView({
                createOpts: { preset: Preset.PublicChat },
            });

            // And when we create a room it will fail
            cli.createRoom.mockRejectedValue(new Error("fail"));

            // When we create the space
            fireEvent.change(view.getAllByRole("textbox")[0], { target: { value: "Room A" } });
            fireEvent.click(view.getByRole("button", { name: "Continue" }));

            // Then we display an error message because it failed
            await waitFor(() => {
                expect(
                    view.getByText((content) => content.toLowerCase().includes("failed to create initial space rooms")),
                ).toBeInTheDocument();
            });
        });

        it("disables button and shows 'Creating rooms' while busy", async () => {
            // Given we are creating a space
            const view = await renderSpaceRoomView({
                createOpts: { preset: Preset.PublicChat },
            });

            // And creating a room will be slow
            cli.createRoom.mockImplementation(
                () =>
                    new Promise(() => {
                        // This promise never resolves
                    }),
            );

            // When we create the space
            fireEvent.change(view.getAllByRole("textbox")[0], { target: { value: "Room A" } });
            fireEvent.click(view.getByRole("button", { name: "Continue" }));

            // Then the "Creating rooms..." message is displayed
            const button = view.getByRole("button");
            expect(button).toBeDisabled();
            expect(button).toHaveValue("Creating rooms…"); // Note the ellipsis
        });
    });

    describe("Spaces: creating a new private space", () => {
        it("creates rooms inside a private space for a team", async () => {
            cli.createRoom.mockResolvedValueOnce({ room_id: "room1" }).mockResolvedValueOnce({ room_id: "room2" });
            SpaceStore.instance.addRoomToSpace = jest.fn();

            // When I create a private space
            const view = await renderSpaceRoomView({
                createOpts: { preset: Preset.PrivateChat },
                name: "Private space",
                topic: "a private space for team A",
            });

            // Then I am asked whether it's individual or team
            expect(view.getByRole("heading", { name: "Who are you working with?" })).toBeInTheDocument();

            // And when I say team
            act(() =>
                view
                    .getByRole("button", {
                        name: "Me and my teammates A private space for you and your teammates",
                    })
                    .click(),
            );

            // Then I am asked what rooms to create
            expect(view.getByRole("heading", { name: "What projects are your team working on?" })).toBeInTheDocument();

            expect(view.getByPlaceholderText(/general/i)).toBeInTheDocument();
            expect(view.getByPlaceholderText(/random/i)).toBeInTheDocument();
            expect(view.getByPlaceholderText(/support/i)).toBeInTheDocument();

            // And when I enter some room names
            const input1 = view.getAllByRole("textbox")[0];
            const input2 = view.getAllByRole("textbox")[1];
            fireEvent.change(input1, { target: { value: "Room 1" } });
            fireEvent.change(input2, { target: { value: "Room 2" } });

            // And click "Continue"
            const button = view.getByRole("button", { name: "Continue" });
            fireEvent.click(button);

            // Then the rooms are created
            await waitFor(() => {
                expect(cli.createRoom).toHaveBeenCalledTimes(2);
            });
        });
    });
});
