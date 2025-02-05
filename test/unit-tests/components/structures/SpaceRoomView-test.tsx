/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type MockedObject } from "jest-mock";
import { type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { render, cleanup, screen, fireEvent } from "jest-matrix-react";

import { stubClient, mockPlatformPeg, unmockPlatformPeg, withClientContextRenderOptions } from "../../../test-utils";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import SpaceRoomView from "../../../../src/components/structures/SpaceRoomView.tsx";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier.ts";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks.ts";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore.ts";
import DMRoomMap from "../../../../src/utils/DMRoomMap.ts";

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

    const renderSpaceRoomView = async (): Promise<ReturnType<typeof render>> => {
        const resizeNotifier = new ResizeNotifier();
        const permalinkCreator = new RoomPermalinkCreator(space);

        const spaceRoomView = render(
            <SpaceRoomView
                space={space}
                resizeNotifier={resizeNotifier}
                permalinkCreator={permalinkCreator}
                onJoinButtonClicked={jest.fn()}
                onRejectButtonClicked={jest.fn()}
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
});
