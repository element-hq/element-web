/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { act, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import dis from "../../../../src/dispatcher/dispatcher";
import { Pill, PillProps, PillType } from "../../../../src/components/views/elements/Pill";
import {
    filterConsole,
    flushPromises,
    mkMessage,
    mkRoomCanonicalAliasEvent,
    mkRoomMemberJoinEvent,
    stubClient,
} from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { Action } from "../../../../src/dispatcher/actions";
import { ButtonEvent } from "../../../../src/components/views/elements/AccessibleButton";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";

describe("<Pill>", () => {
    let client: Mocked<MatrixClient>;
    const permalinkPrefix = "https://matrix.to/#/";
    const room1Alias = "#room1:example.com";
    const room1Id = "!room1:example.com";
    let room1: Room;
    let room1Message: MatrixEvent;
    const room2Id = "!room2:example.com";
    let room2: Room;
    const space1Id = "!space1:example.com";
    let space1: Room;
    const user1Id = "@user1:example.com";
    const user2Id = "@user2:example.com";
    const user3Id = "@user3:example.com";
    let renderResult: RenderResult;
    let pillParentClickHandler: (e: ButtonEvent) => void;

    const renderPill = (props: PillProps): void => {
        const withDefault = {
            inMessage: true,
            shouldShowPillAvatar: true,
            ...props,
        } as PillProps;
        // wrap Pill with a div to allow testing of event bubbling
        renderResult = render(
            <div onClick={pillParentClickHandler}>
                <Pill {...withDefault} />
            </div>,
        );
    };

    filterConsole(
        "Failed to parse permalink Error: Unknown entity type in permalink",
        "Room !room1:example.com does not have an m.room.create event",
        "Room !space1:example.com does not have an m.room.create event",
    );

    beforeEach(() => {
        client = mocked(stubClient());
        SdkContextClass.instance.client = client;
        DMRoomMap.makeShared(client);
        room1 = new Room(room1Id, client, user1Id);
        room1.name = "Room 1";
        const user1JoinRoom1Event = mkRoomMemberJoinEvent(user1Id, room1Id, {
            displayname: "User 1",
        });
        room1.currentState.setStateEvents([
            mkRoomCanonicalAliasEvent(user1Id, room1Id, room1Alias),
            user1JoinRoom1Event,
        ]);
        room1.getMember(user1Id)!.setMembershipEvent(user1JoinRoom1Event);
        room1Message = mkMessage({
            id: "$123-456",
            event: true,
            user: user1Id,
            room: room1Id,
            msg: "Room 1 Message",
        });
        room1.addLiveEvents([room1Message]);

        room2 = new Room(room2Id, client, user1Id);
        room2.currentState.setStateEvents([mkRoomMemberJoinEvent(user2Id, room2Id)]);
        room2.name = "Room 2";

        space1 = new Room(space1Id, client, client.getSafeUserId());
        space1.name = "Space 1";

        client.getRooms.mockReturnValue([room1, room2, space1]);
        client.getRoom.mockImplementation((roomId: string) => {
            if (roomId === room1.roomId) return room1;
            if (roomId === room2.roomId) return room2;
            if (roomId === space1.roomId) return space1;
            return null;
        });

        client.getProfileInfo.mockImplementation(async (userId: string) => {
            if (userId === user2Id) return { displayname: "User 2" };
            throw new Error(`Unknown user ${userId}`);
        });

        jest.spyOn(dis, "dispatch");
        pillParentClickHandler = jest.fn();

        jest.spyOn(global.Math, "random").mockReturnValue(0.123456);
    });

    afterEach(() => {
        jest.spyOn(global.Math, "random").mockRestore();
    });

    describe("when rendering a pill for a room", () => {
        beforeEach(() => {
            renderPill({
                url: permalinkPrefix + room1Id,
            });
        });

        it("should render the expected pill", () => {
            expect(renderResult.asFragment()).toMatchSnapshot();
        });

        describe("when hovering the pill", () => {
            beforeEach(async () => {
                await userEvent.hover(screen.getByText("Room 1"));
            });

            it("should show a tooltip with the room Id", () => {
                expect(screen.getByRole("tooltip", { name: room1Id })).toBeInTheDocument();
            });

            describe("when not hovering the pill any more", () => {
                beforeEach(async () => {
                    await userEvent.unhover(screen.getByText("Room 1"));
                });

                it("should dimiss a tooltip with the room Id", () => {
                    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
                });
            });
        });
    });

    it("should not render a non-permalink", () => {
        renderPill({
            url: "https://example.com/hello",
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should render the expected pill for a space", () => {
        renderPill({
            url: permalinkPrefix + space1Id,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should render the expected pill for a room alias", () => {
        renderPill({
            url: permalinkPrefix + room1Alias,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should render the expected pill for @room", () => {
        renderPill({
            room: room1,
            type: PillType.AtRoomMention,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    describe("when rendering a pill for a user in the room", () => {
        beforeEach(() => {
            renderPill({
                room: room1,
                url: permalinkPrefix + user1Id,
            });
        });

        it("should render as expected", () => {
            expect(renderResult.asFragment()).toMatchSnapshot();
        });

        describe("when clicking the pill", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByText("User 1"));
            });

            it("should dipsatch a view user action and prevent event bubbling", () => {
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewUser,
                    member: room1.getMember(user1Id),
                });

                expect(pillParentClickHandler).not.toHaveBeenCalled();
            });
        });
    });

    it("should render the expected pill for a known user not in the room", async () => {
        renderPill({
            room: room1,
            url: permalinkPrefix + user2Id,
        });

        // wait for profile query via API
        await act(async () => {
            await flushPromises();
        });

        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should render the expected pill for an uknown user not in the room", async () => {
        renderPill({
            room: room1,
            url: permalinkPrefix + user3Id,
        });

        // wait for profile query via API
        await act(async () => {
            await flushPromises();
        });

        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should not render anything if the type cannot be detected", () => {
        renderPill({
            url: permalinkPrefix,
        });
        expect(renderResult.asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div />
            </DocumentFragment>
        `);
    });

    it("should not render an avatar or link when called with inMessage = false and shouldShowPillAvatar = false", () => {
        renderPill({
            inMessage: false,
            shouldShowPillAvatar: false,
            url: permalinkPrefix + room1Id,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });
    it("should render the expected pill for a message in the same room", () => {
        renderPill({
            room: room1,
            url: `${permalinkPrefix}${room1Id}/${room1Message.getId()}`,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should render the expected pill for a message in another room", () => {
        renderPill({
            room: room2,
            url: `${permalinkPrefix}${room1Id}/${room1Message.getId()}`,
        });
        expect(renderResult.asFragment()).toMatchSnapshot();
    });

    it("should not render a pill with an unknown type", () => {
        // @ts-ignore
        renderPill({ type: "unknown" });
        expect(renderResult.asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div />
            </DocumentFragment>
        `);
    });
});
