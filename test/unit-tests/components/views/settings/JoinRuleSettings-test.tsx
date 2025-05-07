/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "jest-matrix-react";
import {
    EventType,
    type GuestAccess,
    type HistoryVisibility,
    JoinRule,
    MatrixEvent,
    Room,
    ClientEvent,
    RoomMember,
    MatrixError,
    Visibility,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { defer, type IDeferred } from "matrix-js-sdk/src/utils";

import {
    clearAllModals,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../../test-utils";
import { filterBoolean } from "../../../../../src/utils/arrays";
import JoinRuleSettings, {
    type JoinRuleSettingsProps,
} from "../../../../../src/components/views/settings/JoinRuleSettings";
import { PreferredRoomVersions } from "../../../../../src/utils/PreferredRoomVersions";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("<JoinRuleSettings />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        getDomain: jest.fn(),
        getLocalAliases: jest.fn().mockReturnValue([]),
        sendStateEvent: jest.fn(),
        upgradeRoom: jest.fn(),
        getProfileInfo: jest.fn(),
        invite: jest.fn().mockResolvedValue(undefined),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getRoomDirectoryVisibility: jest.fn(),
        setRoomDirectoryVisibility: jest.fn(),
    });
    const roomId = "!room:server.org";
    const newRoomId = "!roomUpgraded:server.org";

    const defaultProps = {
        room: new Room(roomId, client, userId),
        closeSettingsFn: jest.fn(),
        onError: jest.fn(),
    };
    const getComponent = (props: Partial<JoinRuleSettingsProps> = {}) =>
        render(<JoinRuleSettings {...defaultProps} {...props} />);

    const setRoomStateEvents = (
        room: Room,
        roomVersion: string,
        joinRule?: JoinRule,
        guestAccess?: GuestAccess,
        history?: HistoryVisibility,
    ): void => {
        const events = filterBoolean<MatrixEvent>([
            new MatrixEvent({
                type: EventType.RoomCreate,
                content: { room_version: roomVersion },
                sender: userId,
                state_key: "",
                room_id: room.roomId,
            }),
            guestAccess &&
                new MatrixEvent({
                    type: EventType.RoomGuestAccess,
                    content: { guest_access: guestAccess },
                    sender: userId,
                    state_key: "",
                    room_id: room.roomId,
                }),
            history &&
                new MatrixEvent({
                    type: EventType.RoomHistoryVisibility,
                    content: { history_visibility: history },
                    sender: userId,
                    state_key: "",
                    room_id: room.roomId,
                }),
            joinRule &&
                new MatrixEvent({
                    type: EventType.RoomJoinRules,
                    content: { join_rule: joinRule },
                    sender: userId,
                    state_key: "",
                    room_id: room.roomId,
                }),
        ]);

        room.currentState.setStateEvents(events);
    };

    beforeEach(() => {
        client.sendStateEvent.mockReset().mockResolvedValue({ event_id: "test" });
        client.isRoomEncrypted.mockReturnValue(false);
        client.upgradeRoom.mockResolvedValue({ replacement_room: newRoomId });
        client.getRoom.mockReturnValue(null);
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "feature_ask_to_join");
    });

    type TestCase = [string, { label: string; unsupportedRoomVersion: string; preferredRoomVersion: string }];
    const testCases: TestCase[] = [
        [
            JoinRule.Knock,
            {
                label: "Ask to join",
                unsupportedRoomVersion: "6",
                preferredRoomVersion: PreferredRoomVersions.KnockRooms,
            },
        ],
        [
            JoinRule.Restricted,
            {
                label: "Space members",
                unsupportedRoomVersion: "8",
                preferredRoomVersion: PreferredRoomVersions.RestrictedRooms,
            },
        ],
    ];

    describe.each(testCases)("%s rooms", (joinRule, { label, unsupportedRoomVersion, preferredRoomVersion }) => {
        afterEach(async () => {
            await clearAllModals();
        });

        describe(`when room does not support join rule ${joinRule}`, () => {
            it(`should not show ${joinRule} room join rule when upgrade is disabled`, () => {
                // room that doesn't support the join rule
                const room = new Room(roomId, client, userId);
                setRoomStateEvents(room, unsupportedRoomVersion);

                getComponent({ room: room, promptUpgrade: false });

                expect(screen.queryByText(label)).not.toBeInTheDocument();
            });

            it(`should show ${joinRule} room join rule when upgrade is enabled`, () => {
                // room that doesn't support the join rule
                const room = new Room(roomId, client, userId);
                setRoomStateEvents(room, unsupportedRoomVersion);

                getComponent({ room: room, promptUpgrade: true });

                expect(within(screen.getByText(label)).getByText("Upgrade required")).toBeInTheDocument();
            });

            it(`upgrades room when changing join rule to ${joinRule}`, async () => {
                const deferredInvites: IDeferred<any>[] = [];
                // room that doesn't support the join rule
                const room = new Room(roomId, client, userId);
                const parentSpace = new Room("!parentSpace:server.org", client, userId);
                jest.spyOn(SpaceStore.instance, "getKnownParents").mockReturnValue(new Set([parentSpace.roomId]));
                setRoomStateEvents(room, unsupportedRoomVersion);
                const memberAlice = new RoomMember(roomId, "@alice:server.org");
                const memberBob = new RoomMember(roomId, "@bob:server.org");
                const memberCharlie = new RoomMember(roomId, "@charlie:server.org");
                jest.spyOn(room, "getMembersWithMembership").mockImplementation((membership) =>
                    membership === KnownMembership.Join ? [memberAlice, memberBob] : [memberCharlie],
                );
                const upgradedRoom = new Room(newRoomId, client, userId);
                setRoomStateEvents(upgradedRoom, preferredRoomVersion);
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return room;
                    if (parentSpace.roomId === id) return parentSpace;
                    return null;
                });

                // resolve invites by hand
                // flushPromises is too blunt to test reliably
                client.invite.mockImplementation(() => {
                    const p = defer<{}>();
                    deferredInvites.push(p);
                    return p.promise;
                });

                getComponent({ room: room, promptUpgrade: true });

                fireEvent.click(screen.getByText(label));

                const dialog = await screen.findByRole("dialog");

                fireEvent.click(within(dialog).getByText("Upgrade"));

                expect(client.upgradeRoom).toHaveBeenCalledWith(roomId, preferredRoomVersion);

                expect(within(dialog).getByText("Upgrading room")).toBeInTheDocument();

                await flushPromises();

                await expect(within(dialog).findByText("Loading new room")).resolves.toBeInTheDocument();

                // "create" our new room, have it come thru sync
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return room;
                    if (newRoomId === id) return upgradedRoom;
                    if (parentSpace.roomId === id) return parentSpace;
                    return null;
                });
                client.emit(ClientEvent.Room, upgradedRoom);

                // invite users
                expect(await screen.findByText("Sending invites... (0 out of 2)")).toBeInTheDocument();
                deferredInvites.pop()!.resolve({});
                expect(await screen.findByText("Sending invites... (1 out of 2)")).toBeInTheDocument();
                deferredInvites.pop()!.resolve({});

                // Usually we see "Updating space..." in the UI here, but we
                // removed the assertion about it, because it sometimes fails,
                // presumably because it disappeared too quickly to be visible.

                await flushPromises();

                // done, modal closed
                await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            });

            it(`upgrades room with no parent spaces or members when changing join rule to ${joinRule}`, async () => {
                // room that doesn't support the join rule
                const room = new Room(roomId, client, userId);
                setRoomStateEvents(room, unsupportedRoomVersion);
                const upgradedRoom = new Room(newRoomId, client, userId);
                setRoomStateEvents(upgradedRoom, preferredRoomVersion);

                getComponent({ room: room, promptUpgrade: true });

                fireEvent.click(screen.getByText(label));

                const dialog = await screen.findByRole("dialog");

                fireEvent.click(within(dialog).getByText("Upgrade"));

                expect(client.upgradeRoom).toHaveBeenCalledWith(roomId, preferredRoomVersion);

                expect(within(dialog).getByText("Upgrading room")).toBeInTheDocument();

                await flushPromises();

                await expect(within(dialog).findByText("Loading new room")).resolves.toBeInTheDocument();

                // "create" our new room, have it come thru sync
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return room;
                    if (newRoomId === id) return upgradedRoom;
                    return null;
                });
                client.emit(ClientEvent.Room, upgradedRoom);

                await flushPromises();
                await flushPromises();

                // done, modal closed
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            });
        });
    });

    describe("knock rooms directory visibility", () => {
        const getCheckbox = () => screen.getByRole("checkbox");
        let room: Room;

        beforeEach(() => (room = new Room(roomId, client, userId)));

        describe("when join rule is knock", () => {
            beforeEach(() => setRoomStateEvents(room, PreferredRoomVersions.KnockRooms, JoinRule.Knock));

            it("should set the visibility to public", async () => {
                jest.spyOn(client, "getRoomDirectoryVisibility").mockResolvedValue({ visibility: Visibility.Private });
                jest.spyOn(client, "setRoomDirectoryVisibility").mockResolvedValue({});
                getComponent({ room });
                fireEvent.click(getCheckbox());
                await act(async () => await flushPromises());
                expect(client.setRoomDirectoryVisibility).toHaveBeenCalledWith(roomId, Visibility.Public);
                expect(getCheckbox()).toBeChecked();
            });

            it("should set the visibility to private", async () => {
                jest.spyOn(client, "getRoomDirectoryVisibility").mockResolvedValue({ visibility: Visibility.Public });
                jest.spyOn(client, "setRoomDirectoryVisibility").mockResolvedValue({});
                getComponent({ room });
                await act(async () => await flushPromises());
                fireEvent.click(getCheckbox());
                await act(async () => await flushPromises());
                expect(client.setRoomDirectoryVisibility).toHaveBeenCalledWith(roomId, Visibility.Private);
                expect(getCheckbox()).not.toBeChecked();
            });

            it("should call onError if setting visibility fails", async () => {
                const error = new MatrixError();
                jest.spyOn(client, "getRoomDirectoryVisibility").mockResolvedValue({ visibility: Visibility.Private });
                jest.spyOn(client, "setRoomDirectoryVisibility").mockRejectedValue(error);
                getComponent({ room });
                fireEvent.click(getCheckbox());
                await act(async () => await flushPromises());
                expect(getCheckbox()).not.toBeChecked();
                expect(defaultProps.onError).toHaveBeenCalledWith(error);
            });
        });

        describe("when the room version is unsupported and upgrade is enabled", () => {
            it("should disable the checkbox", () => {
                setRoomStateEvents(room, "6", JoinRule.Invite);
                getComponent({ promptUpgrade: true, room });
                expect(getCheckbox()).toBeDisabled();
            });
        });

        describe("when join rule is not knock", () => {
            beforeEach(() => {
                setRoomStateEvents(room, PreferredRoomVersions.KnockRooms, JoinRule.Invite);
                getComponent({ room });
            });

            it("should disable the checkbox", () => {
                expect(getCheckbox()).toBeDisabled();
            });

            it("should set the visibility to private by default", () => {
                expect(getCheckbox()).not.toBeChecked();
            });
        });
    });

    it("should not show knock room join rule", async () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const room = new Room(newRoomId, client, userId);
        setRoomStateEvents(room, PreferredRoomVersions.KnockRooms);
        getComponent({ room });
        expect(screen.queryByText("Ask to join")).not.toBeInTheDocument();
    });
});
