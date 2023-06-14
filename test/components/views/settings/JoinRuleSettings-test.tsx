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
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
    EventType,
    GuestAccess,
    HistoryVisibility,
    JoinRule,
    MatrixEvent,
    Room,
    ClientEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { defer, IDeferred } from "matrix-js-sdk/src/utils";

import {
    clearAllModals,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../test-utils";
import { filterBoolean } from "../../../../src/utils/arrays";
import JoinRuleSettings, { JoinRuleSettingsProps } from "../../../../src/components/views/settings/JoinRuleSettings";
import { PreferredRoomVersions } from "../../../../src/utils/PreferredRoomVersions";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";

describe("<JoinRuleSettings />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        getLocalAliases: jest.fn().mockReturnValue([]),
        sendStateEvent: jest.fn(),
        upgradeRoom: jest.fn(),
        getProfileInfo: jest.fn(),
        invite: jest.fn().mockResolvedValue(undefined),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
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
        version = "9",
        joinRule?: JoinRule,
        guestAccess?: GuestAccess,
        history?: HistoryVisibility,
    ): void => {
        const events = filterBoolean<MatrixEvent>([
            new MatrixEvent({
                type: EventType.RoomCreate,
                content: { version },
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
    });

    describe("Restricted rooms", () => {
        afterEach(async () => {
            await clearAllModals();
        });
        describe("When room does not support restricted rooms", () => {
            it("should not show restricted room join rule when upgrade not enabled", () => {
                // room that doesnt support restricted rooms
                const v8Room = new Room(roomId, client, userId);
                setRoomStateEvents(v8Room, "8");

                getComponent({ room: v8Room, promptUpgrade: false });

                expect(screen.queryByText("Space members")).not.toBeInTheDocument();
            });

            it("should show restricted room join rule when upgrade is enabled", () => {
                // room that doesnt support restricted rooms
                const v8Room = new Room(roomId, client, userId);
                setRoomStateEvents(v8Room, "8");

                getComponent({ room: v8Room, promptUpgrade: true });

                expect(screen.getByText("Space members")).toBeInTheDocument();
                expect(screen.getByText("Upgrade required")).toBeInTheDocument();
            });

            it("upgrades room when changing join rule to restricted", async () => {
                const deferredInvites: IDeferred<any>[] = [];
                // room that doesnt support restricted rooms
                const v8Room = new Room(roomId, client, userId);
                const parentSpace = new Room("!parentSpace:server.org", client, userId);
                jest.spyOn(SpaceStore.instance, "getKnownParents").mockReturnValue(new Set([parentSpace.roomId]));
                setRoomStateEvents(v8Room, "8");
                const memberAlice = new RoomMember(roomId, "@alice:server.org");
                const memberBob = new RoomMember(roomId, "@bob:server.org");
                const memberCharlie = new RoomMember(roomId, "@charlie:server.org");
                jest.spyOn(v8Room, "getMembersWithMembership").mockImplementation((membership) =>
                    membership === "join" ? [memberAlice, memberBob] : [memberCharlie],
                );
                const upgradedRoom = new Room(newRoomId, client, userId);
                setRoomStateEvents(upgradedRoom);
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return v8Room;
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

                getComponent({ room: v8Room, promptUpgrade: true });

                fireEvent.click(screen.getByText("Space members"));

                const dialog = await screen.findByRole("dialog");

                fireEvent.click(within(dialog).getByText("Upgrade"));

                expect(client.upgradeRoom).toHaveBeenCalledWith(roomId, PreferredRoomVersions.RestrictedRooms);

                expect(within(dialog).getByText("Upgrading room")).toBeInTheDocument();

                await flushPromises();

                expect(within(dialog).getByText("Loading new room")).toBeInTheDocument();

                // "create" our new room, have it come thru sync
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return v8Room;
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

                // update spaces
                expect(await screen.findByText("Updating space...")).toBeInTheDocument();

                await flushPromises();

                // done, modal closed
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            });

            it("upgrades room with no parent spaces or members when changing join rule to restricted", async () => {
                // room that doesnt support restricted rooms
                const v8Room = new Room(roomId, client, userId);
                setRoomStateEvents(v8Room, "8");
                const upgradedRoom = new Room(newRoomId, client, userId);
                setRoomStateEvents(upgradedRoom);

                getComponent({ room: v8Room, promptUpgrade: true });

                fireEvent.click(screen.getByText("Space members"));

                const dialog = await screen.findByRole("dialog");

                fireEvent.click(within(dialog).getByText("Upgrade"));

                expect(client.upgradeRoom).toHaveBeenCalledWith(roomId, PreferredRoomVersions.RestrictedRooms);

                expect(within(dialog).getByText("Upgrading room")).toBeInTheDocument();

                await flushPromises();

                expect(within(dialog).getByText("Loading new room")).toBeInTheDocument();

                // "create" our new room, have it come thru sync
                client.getRoom.mockImplementation((id) => {
                    if (roomId === id) return v8Room;
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
});
