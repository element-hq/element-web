/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, fireEvent, render, screen } from "jest-matrix-react";
import {
    EventTimeline,
    EventType,
    JoinRule,
    MatrixError,
    MatrixEvent,
    Room,
    RoomMember,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import React from "react";

import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";
import { RoomSettingsTab } from "../../../../../src/components/views/dialogs/RoomSettingsDialog";
import { RoomKnocksBar } from "../../../../../src/components/views/rooms/RoomKnocksBar";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import dis from "../../../../../src/dispatcher/dispatcher";
import Modal from "../../../../../src/Modal";
import {
    clearAllModals,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../../test-utils";
import * as languageHandler from "../../../../../src/languageHandler";

describe("RoomKnocksBar", () => {
    const userId = "@alice:example.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        invite: jest.fn(),
        kick: jest.fn(),
    });
    const roomId = "#ask-to-join:example.org";
    const member = new RoomMember(roomId, userId);
    const room = new Room(roomId, client, userId);
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;

    type ButtonNames = "Approve" | "Deny" | "View" | "View message";
    const getButton = (name: ButtonNames) => screen.getByRole("button", { name });
    const getComponent = (room: Room) =>
        render(
            <MatrixClientContext.Provider value={client}>
                <RoomKnocksBar room={room} />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        jest.spyOn(room, "getMember").mockReturnValue(member);
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
    });

    it("does not render if the room join rule is not knock", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
        jest.spyOn(room, "getMembersWithMembership").mockReturnValue([member]);
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(true);
        expect(getComponent(room).container.firstChild).toBeNull();
    });

    describe("without requests to join", () => {
        beforeEach(() => {
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([]);
            jest.spyOn(room, "canInvite").mockReturnValue(true);
            jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(true);
        });

        it("does not render if user can neither approve nor deny", () => {
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(false);
            expect(getComponent(room).container.firstChild).toBeNull();
        });

        it("does not render if user cannot approve", () => {
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            expect(getComponent(room).container.firstChild).toBeNull();
        });

        it("does not render if user cannot deny", () => {
            jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(false);
            expect(getComponent(room).container.firstChild).toBeNull();
        });

        it("does not render if user can approve and deny", () => {
            expect(getComponent(room).container.firstChild).toBeNull();
        });
    });

    describe("with requests to join", () => {
        const error = new MatrixError();
        const bob = new RoomMember(roomId, "@bob:example.org");
        const jane = new RoomMember(roomId, "@jane:example.org");
        const john = new RoomMember(roomId, "@john:example.org");
        const other = new RoomMember(roomId, "@doe:example.org");

        bob.setMembershipEvent(
            new MatrixEvent({
                content: { displayname: "Bob", membership: KnownMembership.Knock },
                type: EventType.RoomMember,
            }),
        );
        jane.setMembershipEvent(
            new MatrixEvent({
                content: { displayname: "Jane", membership: KnownMembership.Knock },
                type: EventType.RoomMember,
            }),
        );
        john.setMembershipEvent(
            new MatrixEvent({
                content: { displayname: "John", membership: KnownMembership.Knock },
                type: EventType.RoomMember,
            }),
        );
        other.setMembershipEvent(
            new MatrixEvent({ content: { membership: KnownMembership.Knock }, type: EventType.RoomMember }),
        );

        beforeEach(async () => {
            await clearAllModals();
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob]);
            jest.spyOn(room, "canInvite").mockReturnValue(true);
            jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(true);
            jest.spyOn(Modal, "createDialog");
            jest.spyOn(dis, "dispatch");
            jest.spyOn(languageHandler, "getUserLanguage").mockReturnValue("en-GB");
        });

        it("does not render if user can neither approve nor deny", () => {
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(false);
            expect(getComponent(room).container.firstChild).toBeNull();
        });

        it("unhides the bar when a new knock request appears", () => {
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([]);
            const { container } = getComponent(room);
            expect(container.firstChild).toBeNull();
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob]);
            act(() => {
                room.emit(RoomStateEvent.Update, state);
            });
            expect(container.firstChild).not.toBeNull();
        });

        it("updates when the list of knocking users changes", () => {
            getComponent(room);
            expect(screen.getByRole("heading")).toHaveTextContent("Asking to join");
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob, jane]);
            act(() => {
                room.emit(RoomStateEvent.Update, state);
            });
            expect(screen.getByRole("heading")).toHaveTextContent("2 people asking to join");
        });

        describe("when knock members count is 1", () => {
            beforeEach(() => jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob]));

            it("renders a heading and a paragraph with name and user ID", () => {
                const { container } = getComponent(room);
                expect(screen.getByRole("heading")).toHaveTextContent("Asking to join");
                expect(container.querySelector(".mx_RoomKnocksBar_paragraph")).toHaveTextContent(
                    `${bob.name} (${bob.userId})`,
                );
            });

            describe("when a knock reason is not provided", () => {
                it("does not render a link to open the room settings people tab", () => {
                    getComponent(room);
                    expect(screen.queryByRole("button", { name: "View message" })).not.toBeInTheDocument();
                });
            });

            describe("when a knock reason is provided", () => {
                it("renders a link to open the room settings people tab", () => {
                    bob.setMembershipEvent(
                        new MatrixEvent({
                            content: { displayname: "Bob", membership: KnownMembership.Knock, reason: "some reason" },
                            type: EventType.RoomMember,
                        }),
                    );
                    getComponent(room);
                    fireEvent.click(getButton("View message"));
                    expect(dis.dispatch).toHaveBeenCalledWith({
                        action: "open_room_settings",
                        initial_tab_id: RoomSettingsTab.People,
                        room_id: roomId,
                    });
                });
            });

            type TestCase = [string, ButtonNames, () => void];
            it.each<TestCase>([
                ["deny request fails", "Deny", () => jest.spyOn(client, "kick").mockRejectedValue(error)],
                ["deny request succeeds", "Deny", () => jest.spyOn(client, "kick").mockResolvedValue({})],
                ["approve request fails", "Approve", () => jest.spyOn(client, "invite").mockRejectedValue(error)],
                ["approve request succeeds", "Approve", () => jest.spyOn(client, "invite").mockResolvedValue({})],
            ])("toggles the disabled attribute for the buttons when a %s", async (_, buttonName, setup) => {
                setup();
                getComponent(room);
                fireEvent.click(getButton(buttonName));
                expect(getButton("Deny")).toHaveAttribute("disabled");
                expect(getButton("Approve")).toHaveAttribute("disabled");
                await act(() => flushPromises());
                expect(getButton("Deny")).not.toHaveAttribute("disabled");
                expect(getButton("Approve")).not.toHaveAttribute("disabled");
            });

            it("disables the deny button if the power level is insufficient", () => {
                jest.spyOn(state, "hasSufficientPowerLevelFor").mockReturnValue(false);
                getComponent(room);
                expect(getButton("Deny")).toHaveAttribute("disabled");
            });

            it("calls kick on deny", async () => {
                jest.spyOn(client, "kick").mockResolvedValue({});
                getComponent(room);
                fireEvent.click(getButton("Deny"));
                await act(() => flushPromises());
                expect(client.kick).toHaveBeenCalledWith(roomId, bob.userId);
            });

            it("displays an error when a deny request fails", async () => {
                jest.spyOn(client, "kick").mockRejectedValue(error);
                getComponent(room);
                fireEvent.click(getButton("Deny"));
                await act(() => flushPromises());
                expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                    title: error.name,
                    description: error.message,
                });
            });

            it("disables the approve button if the power level is insufficient", () => {
                jest.spyOn(room, "canInvite").mockReturnValue(false);
                getComponent(room);
                expect(getButton("Approve")).toHaveAttribute("disabled");
            });

            it("calls invite on approve", async () => {
                jest.spyOn(client, "invite").mockResolvedValue({});
                getComponent(room);
                fireEvent.click(getButton("Approve"));
                await act(() => flushPromises());
                expect(client.invite).toHaveBeenCalledWith(roomId, bob.userId);
            });

            it("displays an error when an approval fails", async () => {
                jest.spyOn(client, "invite").mockRejectedValue(error);
                getComponent(room);
                fireEvent.click(getButton("Approve"));
                await act(() => flushPromises());
                expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                    title: error.name,
                    description: error.message,
                });
            });

            it("hides the bar when someone else approves or denies the waiting person", () => {
                getComponent(room);
                jest.spyOn(room, "getMembersWithMembership").mockReturnValue([]);
                act(() => {
                    room.emit(RoomStateEvent.Members, new MatrixEvent(), state, bob);
                });
                expect(getComponent(room).container.firstChild).toBeNull();
            });
        });

        describe("when knock members count is greater than 1", () => {
            beforeEach(() => {
                jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob, jane]);
                getComponent(room);
            });

            it("renders a heading with count", () => {
                expect(screen.getByRole("heading")).toHaveTextContent("2 people asking to join");
            });

            it("renders a button to open the room settings people tab", () => {
                fireEvent.click(getButton("View"));
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: "open_room_settings",
                    initial_tab_id: RoomSettingsTab.People,
                    room_id: roomId,
                });
            });
        });

        describe("when knock members count is 2", () => {
            it("renders a paragraph with two names", () => {
                jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob, jane]);
                const { container } = getComponent(room);
                expect(container.querySelector(".mx_RoomKnocksBar_paragraph")).toHaveTextContent(
                    `${bob.name} and ${jane.name}`,
                );
            });
        });

        describe("when knock members count is 3", () => {
            it("renders a paragraph with three names", () => {
                jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob, jane, john]);
                const { container } = getComponent(room);
                expect(container.querySelector(".mx_RoomKnocksBar_paragraph")).toHaveTextContent(
                    `${bob.name}, ${jane.name} and ${john.name}`,
                );
            });
        });

        describe("when knock count is greater than 3", () => {
            it("renders a paragraph with two names and a count", () => {
                jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bob, jane, john, other]);
                const { container } = getComponent(room);
                expect(container.querySelector(".mx_RoomKnocksBar_paragraph")).toHaveTextContent(
                    `${bob.name}, ${jane.name} and 2 others`,
                );
            });
        });
    });
});
