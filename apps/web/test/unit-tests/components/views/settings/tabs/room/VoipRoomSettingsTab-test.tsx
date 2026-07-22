/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, type RenderResult, waitFor } from "jest-matrix-react";
import { type MatrixClient, type Room, type MatrixEvent, EventType, JoinRule } from "matrix-js-sdk/src/matrix";

import { mkStubRoom, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { VoipRoomSettingsTab } from "../../../../../../../src/components/views/settings/tabs/room/VoipRoomSettingsTab";
import { ElementCallEventType, ElementCallMemberEventType } from "../../../../../../../src/call-types";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../../src/settings/SettingLevel";

describe("VoipRoomSettingsTab", () => {
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let room: Room;

    const renderTab = (): RenderResult => {
        return render(<VoipRoomSettingsTab room={room} />);
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = mkStubRoom(roomId, "test room", cli);

        jest.spyOn(cli, "sendStateEvent");
        jest.spyOn(cli, "getRoom").mockReturnValue(room);
    });

    describe("Element Call", () => {
        const mockPowerLevels = (events: Record<string, number>): void => {
            jest.spyOn(room.currentState, "getStateEvents").mockReturnValue({
                getContent: () => ({
                    events,
                }),
            } as unknown as MatrixEvent);
        };

        const getElementCallSwitch = (tab: RenderResult): HTMLElement => {
            return tab.getByLabelText("Enable Element Call as an additional calling option in this room")!;
        };

        describe("correct state", () => {
            it("shows enabled when call member power level is 0", () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 0 });

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).toBeChecked();
            });

            it.each([1, 50, 100])("shows disabled when call member power level is 0", (level: number) => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: level });

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).not.toBeChecked();
            });
        });

        describe("enabling/disabling", () => {
            describe("enabling Element calls", () => {
                beforeEach(() => {
                    mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                });

                it("enables Element calls in public room", async () => {
                    jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);

                    const tab = renderTab();

                    fireEvent.click(getElementCallSwitch(tab));
                    await waitFor(() =>
                        expect(cli.sendStateEvent).toHaveBeenCalledWith(
                            room.roomId,
                            EventType.RoomPowerLevels,
                            expect.objectContaining({
                                events: {
                                    [ElementCallEventType.name]: 50,
                                    [ElementCallMemberEventType.name]: 0,
                                },
                            }),
                        ),
                    );
                });

                it("enables Element calls in private room", async () => {
                    jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);

                    const tab = renderTab();

                    fireEvent.click(getElementCallSwitch(tab));
                    await waitFor(() =>
                        expect(cli.sendStateEvent).toHaveBeenCalledWith(
                            room.roomId,
                            EventType.RoomPowerLevels,
                            expect.objectContaining({
                                events: {
                                    [ElementCallEventType.name]: 0,
                                    [ElementCallMemberEventType.name]: 0,
                                },
                            }),
                        ),
                    );
                });
            });

            it("disables Element calls", async () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 0 });

                const tab = renderTab();

                fireEvent.click(getElementCallSwitch(tab));
                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RoomPowerLevels,
                        expect.objectContaining({
                            events: {
                                [ElementCallEventType.name]: 100,
                                [ElementCallMemberEventType.name]: 100,
                            },
                        }),
                    ),
                );
            });
        });

        describe("slot handling", () => {
            const mockSlotSession = (getRtcSlot: () => { status?: string } | undefined = () => undefined): void => {
                jest.mocked(cli.matrixRTC.getRoomSession).mockReturnValue({
                    slotId: "m.call#ROOM",
                    slotDescription: { application: "m.call", id: "ROOM" },
                    getRtcSlot,
                } as unknown as ReturnType<typeof cli.matrixRTC.getRoomSession>);
                const slotContent = getRtcSlot();
                jest.mocked(cli.matrixRTC.isSlotClosed).mockReturnValue(
                    slotContent ? slotContent.status === "closed" : undefined,
                );
            };

            beforeEach(() => {
                act(() => {
                    SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, true);
                });
            });

            afterEach(() => {
                act(() => {
                    SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, false);
                });
            });

            it("opens/creates the slot when enabling Element calls", async () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                mockSlotSession();

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RTCSlot,
                        expect.objectContaining({ status: "open", application: { type: "m.call" } }),
                        "m.call#ROOM",
                    ),
                );
            });

            it("reopens the slot when enabling Element calls", async () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                mockSlotSession(() => ({ status: "closed", application: { type: "m.call" } }));

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RTCSlot,
                        expect.objectContaining({ status: "open", application: { type: "m.call" } }),
                        "m.call#ROOM",
                    ),
                );
            });

            it("closes the slot when disabling Element calls", async () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 0 });
                mockSlotSession(() => ({ status: "open", application: { type: "m.call" } }));

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RTCSlot,
                        { status: "closed", application: { type: "m.call" } },
                        "m.call#ROOM",
                    ),
                );
            });

            it("renders the switch as off when no slot has ever been created, even though power levels say enabled", () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 0 });
                mockSlotSession();

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).not.toBeChecked();
            });

            it("does not touch the slot when the labs flag is disabled", async () => {
                SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, false);
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                mockSlotSession();

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RoomPowerLevels,
                        expect.anything(),
                    ),
                );
                expect(cli.sendStateEvent).not.toHaveBeenCalledWith(
                    room.roomId,
                    EventType.RTCSlot,
                    expect.anything(),
                    expect.anything(),
                );
            });

            it("does not touch power levels or the slot when the user cannot send RTCSlot state events", () => {
                jest.spyOn(room.currentState, "maySendStateEvent").mockImplementation(
                    (eventType) => eventType !== EventType.RTCSlot,
                );
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                mockSlotSession();

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                expect(cli.sendStateEvent).not.toHaveBeenCalled();
            });

            it("disables the switch when the feature is on and the user cannot send RTCSlot state events", () => {
                jest.spyOn(room.currentState, "maySendStateEvent").mockImplementation(
                    (eventType) => eventType !== EventType.RTCSlot,
                );
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).toBeDisabled();
            });

            it("does not disable the switch for missing RTCSlot permission when the feature is off", () => {
                act(() => {
                    SettingsStore.setValue("feature_matrixrtc_slots", null, SettingLevel.DEVICE, false);
                });
                jest.spyOn(room.currentState, "maySendStateEvent").mockImplementation(
                    (eventType) => eventType !== EventType.RTCSlot,
                );
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).not.toBeDisabled();
            });

            it("does not resend the slot event when it's already open", async () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 100 });
                mockSlotSession(() => ({ status: "open", application: { type: "m.call" } }));

                const tab = renderTab();
                fireEvent.click(getElementCallSwitch(tab));

                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RoomPowerLevels,
                        expect.anything(),
                    ),
                );
                expect(cli.sendStateEvent).not.toHaveBeenCalledWith(
                    room.roomId,
                    EventType.RTCSlot,
                    expect.anything(),
                    expect.anything(),
                );
            });

            it("renders the switch as off when the slot is closed, even though power levels say enabled", () => {
                mockPowerLevels({ [ElementCallMemberEventType.name]: 0 });
                mockSlotSession(() => ({ status: "closed", application: { type: "m.call" } }));

                const tab = renderTab();

                expect(getElementCallSwitch(tab)).not.toBeChecked();
            });
        });
    });
});
