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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EventType, GuestAccess, HistoryVisibility, JoinRule, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import SecurityRoomSettingsTab from "../../../../../../src/components/views/settings/tabs/room/SecurityRoomSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import {
    clearAllModals,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../../../test-utils";
import { filterBoolean } from "../../../../../../src/utils/arrays";

describe("<SecurityRoomSettingsTab />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        isRoomEncrypted: jest.fn(),
        getLocalAliases: jest.fn().mockReturnValue([]),
        sendStateEvent: jest.fn(),
    });
    const roomId = "!room:server.org";

    const getComponent = (room: Room, closeSettingsFn = jest.fn()) =>
        render(<SecurityRoomSettingsTab room={room} closeSettingsFn={closeSettingsFn} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            ),
        });

    const setRoomStateEvents = (
        room: Room,
        joinRule?: JoinRule,
        guestAccess?: GuestAccess,
        history?: HistoryVisibility,
    ): void => {
        const events = filterBoolean<MatrixEvent>([
            new MatrixEvent({
                type: EventType.RoomCreate,
                content: { version: "test" },
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

    beforeEach(async () => {
        client.sendStateEvent.mockReset().mockResolvedValue({ event_id: "test" });
        client.isRoomEncrypted.mockReturnValue(false);
        jest.spyOn(SettingsStore, "getValue").mockRestore();

        await clearAllModals();
    });

    describe("join rule", () => {
        it("warns when trying to make an encrypted room public", async () => {
            const room = new Room(roomId, client, userId);
            client.isRoomEncrypted.mockReturnValue(true);
            setRoomStateEvents(room, JoinRule.Invite);

            getComponent(room);

            fireEvent.click(screen.getByLabelText("Public"));

            const modal = await screen.findByRole("dialog");

            expect(modal).toMatchSnapshot();

            fireEvent.click(screen.getByText("Cancel"));

            // join rule not updated
            expect(screen.getByLabelText("Private (invite only)").hasAttribute("checked")).toBeTruthy();
        });

        it("updates join rule", async () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Invite);

            getComponent(room);

            fireEvent.click(screen.getByLabelText("Public"));

            await flushPromises();

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RoomJoinRules,
                {
                    join_rule: JoinRule.Public,
                },
                "",
            );
        });

        it("handles error when updating join rule fails", async () => {
            const room = new Room(roomId, client, userId);
            client.sendStateEvent.mockRejectedValue("oups");
            setRoomStateEvents(room, JoinRule.Invite);

            getComponent(room);

            fireEvent.click(screen.getByLabelText("Public"));

            await flushPromises();

            const dialog = await screen.findByRole("dialog");

            expect(dialog).toMatchSnapshot();

            fireEvent.click(within(dialog).getByText("OK"));
        });

        it("displays advanced section toggle when join rule is public", () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Public);

            getComponent(room);

            expect(screen.getByText("Show advanced")).toBeInTheDocument();
        });

        it("does not display advanced section toggle when join rule is not public", () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Invite);

            getComponent(room);

            expect(screen.queryByText("Show advanced")).not.toBeInTheDocument();
        });
    });

    describe("guest access", () => {
        it("uses forbidden by default when room has no guest access event", () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Public);

            getComponent(room);

            fireEvent.click(screen.getByText("Show advanced"));

            expect(screen.getByLabelText("Enable guest access").getAttribute("aria-checked")).toBe("false");
        });

        it("updates guest access on toggle", () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Public);
            getComponent(room);
            fireEvent.click(screen.getByText("Show advanced"));

            fireEvent.click(screen.getByLabelText("Enable guest access"));

            // toggle set immediately
            expect(screen.getByLabelText("Enable guest access").getAttribute("aria-checked")).toBe("true");

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RoomGuestAccess,
                { guest_access: GuestAccess.CanJoin },
                "",
            );
        });

        it("logs error and resets state when updating guest access fails", async () => {
            client.sendStateEvent.mockRejectedValue("oups");
            jest.spyOn(logger, "error").mockImplementation(() => {});
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room, JoinRule.Public, GuestAccess.CanJoin);
            getComponent(room);
            fireEvent.click(screen.getByText("Show advanced"));

            fireEvent.click(screen.getByLabelText("Enable guest access"));

            // toggle set immediately
            expect(screen.getByLabelText("Enable guest access").getAttribute("aria-checked")).toBe("false");

            await flushPromises();
            expect(client.sendStateEvent).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith("oups");

            // toggle reset to old value
            expect(screen.getByLabelText("Enable guest access").getAttribute("aria-checked")).toBe("true");
        });
    });

    describe("history visibility", () => {
        it("does not render section when RoomHistorySettings feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room);

            getComponent(room);

            expect(screen.queryByText("Who can read history")).not.toBeInTheDocument();
        });

        it("uses shared as default history visibility when no state event found", () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room);

            getComponent(room);

            expect(screen.getByText("Who can read history?").parentElement).toMatchSnapshot();
            expect(screen.getByDisplayValue(HistoryVisibility.Shared)).toBeChecked();
        });

        it("does not render world readable option when room is encrypted", () => {
            const room = new Room(roomId, client, userId);
            client.isRoomEncrypted.mockReturnValue(true);
            setRoomStateEvents(room);

            getComponent(room);

            expect(screen.queryByDisplayValue(HistoryVisibility.WorldReadable)).not.toBeInTheDocument();
        });

        it("renders world readable option when room is encrypted and history is already set to world readable", () => {
            const room = new Room(roomId, client, userId);
            client.isRoomEncrypted.mockReturnValue(true);
            setRoomStateEvents(room, undefined, undefined, HistoryVisibility.WorldReadable);

            getComponent(room);

            expect(screen.getByDisplayValue(HistoryVisibility.WorldReadable)).toBeInTheDocument();
        });

        it("updates history visibility", () => {
            const room = new Room(roomId, client, userId);

            getComponent(room);

            fireEvent.click(screen.getByDisplayValue(HistoryVisibility.Invited));

            // toggle updated immediately
            expect(screen.getByDisplayValue(HistoryVisibility.Invited)).toBeChecked();

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RoomHistoryVisibility,
                {
                    history_visibility: HistoryVisibility.Invited,
                },
                "",
            );
        });

        it("handles error when updating history visibility", async () => {
            const room = new Room(roomId, client, userId);
            client.sendStateEvent.mockRejectedValue("oups");
            jest.spyOn(logger, "error").mockImplementation(() => {});

            getComponent(room);

            fireEvent.click(screen.getByDisplayValue(HistoryVisibility.Invited));

            // toggle updated immediately
            expect(screen.getByDisplayValue(HistoryVisibility.Invited)).toBeChecked();

            await flushPromises();

            // reset to before updated value
            expect(screen.getByDisplayValue(HistoryVisibility.Shared)).toBeChecked();
            expect(logger.error).toHaveBeenCalledWith("oups");
        });
    });

    describe("encryption", () => {
        it("displays encryption as enabled", () => {
            const room = new Room(roomId, client, userId);
            client.isRoomEncrypted.mockReturnValue(true);
            setRoomStateEvents(room);
            getComponent(room);

            expect(screen.getByLabelText("Encrypted")).toBeChecked();
            // can't disable encryption once enabled
            expect(screen.getByLabelText("Encrypted").getAttribute("aria-disabled")).toEqual("true");
        });

        it("asks users to confirm when setting room to encrypted", async () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room);
            getComponent(room);

            expect(screen.getByLabelText("Encrypted")).not.toBeChecked();

            fireEvent.click(screen.getByLabelText("Encrypted"));

            const dialog = await screen.findByRole("dialog");

            fireEvent.click(within(dialog).getByText("Cancel"));

            expect(client.sendStateEvent).not.toHaveBeenCalled();
            expect(screen.getByLabelText("Encrypted")).not.toBeChecked();
        });

        it("enables encryption after confirmation", async () => {
            const room = new Room(roomId, client, userId);
            setRoomStateEvents(room);
            getComponent(room);

            expect(screen.getByLabelText("Encrypted")).not.toBeChecked();

            fireEvent.click(screen.getByLabelText("Encrypted"));

            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByText("Enable encryption?")).toBeInTheDocument();
            fireEvent.click(within(dialog).getByText("OK"));

            await waitFor(() =>
                expect(client.sendStateEvent).toHaveBeenCalledWith(room.roomId, EventType.RoomEncryption, {
                    algorithm: "m.megolm.v1.aes-sha2",
                }),
            );
        });

        it("renders world readable option when room is encrypted and history is already set to world readable", () => {
            const room = new Room(roomId, client, userId);
            client.isRoomEncrypted.mockReturnValue(true);
            setRoomStateEvents(room, undefined, undefined, HistoryVisibility.WorldReadable);

            getComponent(room);

            expect(screen.getByDisplayValue(HistoryVisibility.WorldReadable)).toBeInTheDocument();
        });

        it("updates history visibility", () => {
            const room = new Room(roomId, client, userId);

            getComponent(room);

            fireEvent.click(screen.getByDisplayValue(HistoryVisibility.Invited));

            // toggle updated immediately
            expect(screen.getByDisplayValue(HistoryVisibility.Invited)).toBeChecked();

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                room.roomId,
                EventType.RoomHistoryVisibility,
                {
                    history_visibility: HistoryVisibility.Invited,
                },
                "",
            );
        });

        it("handles error when updating history visibility", async () => {
            const room = new Room(roomId, client, userId);
            client.sendStateEvent.mockRejectedValue("oups");
            jest.spyOn(logger, "error").mockImplementation(() => {});

            getComponent(room);

            fireEvent.click(screen.getByDisplayValue(HistoryVisibility.Invited));

            // toggle updated immediately
            expect(screen.getByDisplayValue(HistoryVisibility.Invited)).toBeChecked();

            await flushPromises();

            // reset to before updated value
            expect(screen.getByDisplayValue(HistoryVisibility.Shared)).toBeChecked();
            expect(logger.error).toHaveBeenCalledWith("oups");
        });
    });
});
