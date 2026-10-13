/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { EventTimeline, type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { LinkedTextContext } from "@element-hq/web-shared-components";
import {
    clientAndSDKContextRenderOptions,
    filterConsole,
    mkEvent,
    mkRoomMemberJoinEvent,
    mkThirdPartyInviteEvent,
    stubClient,
} from "test-utils";

import { LocalRoom } from "../../../models/LocalRoom";
import NewRoomIntro from "./NewRoomIntro";
import DMRoomMap from "../../../utils/DMRoomMap";
import { DirectoryMember } from "../../../utils/direct-messages";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import type { RoomContextType } from "../../../contexts/RoomContext.ts";
import { SDKContextClass } from "../../../contexts/SDKContextClass.ts";

const renderNewRoomIntro = (client: MatrixClient, room: Room | LocalRoom) => {
    render(
        <ScopedRoomContextProvider {...({ room, roomId: room.roomId } as unknown as RoomContextType)}>
            <LinkedTextContext.Provider value={{}}>
                <NewRoomIntro />
            </LinkedTextContext.Provider>
        </ScopedRoomContextProvider>,
        clientAndSDKContextRenderOptions(client, SDKContextClass.instance),
    );
};

describe("NewRoomIntro", () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    const userId = "@user:example.com";

    filterConsole("Room !room:example.com does not have an m.room.create event");

    beforeEach(() => {
        client = stubClient();
        DMRoomMap.makeShared(client);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("for a DM Room", () => {
        beforeEach(() => {
            vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            const room = new Room(roomId, client, client.getUserId()!);
            room.name = "test_room";
            renderNewRoomIntro(client, room);
        });

        it("should render the expected intro", () => {
            const expected = `This is the beginning of your direct message history with test_room.`;
            expect(
                screen.getByText((id, element) => element?.tagName === "SPAN" && element?.textContent === expected),
            ).toBeVisible();
        });
    });

    it("should render as expected for a DM room with a single third-party invite", () => {
        const room = new Room(roomId, client, client.getSafeUserId());
        room.currentState.setStateEvents([
            mkRoomMemberJoinEvent(client.getSafeUserId(), room.roomId),
            mkThirdPartyInviteEvent(client.getSafeUserId(), "user@example.com", room.roomId),
        ]);
        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
        vi.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([room.roomId]));
        renderNewRoomIntro(client, room);

        expect(screen.getByText("Once everyone has joined, you’ll be able to chat")).toBeInTheDocument();
        expect(
            screen.queryByText(
                "Only the two of you are in this conversation, unless either of you invites anyone to join.",
            ),
        ).not.toBeInTheDocument();
    });

    describe("for a DM LocalRoom", () => {
        beforeEach(() => {
            vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
            const localRoom = new LocalRoom(roomId, client, client.getUserId()!);
            localRoom.name = "test_room";
            localRoom.targets.push(new DirectoryMember({ user_id: userId }));
            renderNewRoomIntro(client, localRoom);
        });

        it("should render the expected intro", () => {
            const expected = `Send your first message to invite test_room to chat`;
            expect(
                screen.getByText((id, element) => element?.tagName === "SPAN" && element?.textContent === expected),
            ).toBeVisible();
        });
    });

    describe("topic", () => {
        let room: Room;

        beforeEach(() => {
            room = new Room(roomId, client, userId);
            room.getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.setStateEvents([mkRoomMemberJoinEvent(client.getSafeUserId(), room.roomId)]);
            vi.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([room.roomId]));
        });

        function addTopicToRoom(topic: string) {
            const topicEvent = mkEvent({
                type: "m.room.topic",
                room: roomId,
                user: userId,
                content: {
                    topic,
                },
                ts: 123,
                event: true,
            });

            room.addLiveEvents([topicEvent], { addToState: true });
        }

        it("should render the topic", () => {
            addTopicToRoom("Test topic");
            renderNewRoomIntro(client, room);
            expect(screen.getByText("Test topic")).toBeVisible();
        });

        it("should render a link in the topic", () => {
            addTopicToRoom("This is a link: https://matrix.org/");
            renderNewRoomIntro(client, room);
            expect(screen.getByTestId("topic")).toMatchSnapshot();
        });

        it("should be able to add a topic", () => {
            addTopicToRoom("Test topic");
            vi.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "maySendStateEvent").mockReturnValue(
                true,
            );
            const spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});

            renderNewRoomIntro(client, room);
            screen.getByRole("button", { name: "edit" }).click();
            expect(spyDispatcher).toHaveBeenCalledWith(
                {
                    action: "open_room_settings",
                    room_id: room.roomId,
                },
                true,
            );
        });
    });
});
