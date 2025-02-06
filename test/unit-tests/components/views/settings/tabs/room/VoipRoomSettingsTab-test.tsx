/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult, waitFor } from "jest-matrix-react";
import { type MatrixClient, type Room, type MatrixEvent, EventType, JoinRule } from "matrix-js-sdk/src/matrix";

import { mkStubRoom, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { VoipRoomSettingsTab } from "../../../../../../../src/components/views/settings/tabs/room/VoipRoomSettingsTab";
import { ElementCall } from "../../../../../../../src/models/Call";

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
            return tab.container.querySelector("[data-testid='element-call-switch']")!;
        };

        describe("correct state", () => {
            it("shows enabled when call member power level is 0", () => {
                mockPowerLevels({ [ElementCall.MEMBER_EVENT_TYPE.name]: 0 });

                const tab = renderTab();

                expect(getElementCallSwitch(tab).querySelector("[aria-checked='true']")).toBeTruthy();
            });

            it.each([1, 50, 100])("shows disabled when call member power level is 0", (level: number) => {
                mockPowerLevels({ [ElementCall.MEMBER_EVENT_TYPE.name]: level });

                const tab = renderTab();

                expect(getElementCallSwitch(tab).querySelector("[aria-checked='false']")).toBeTruthy();
            });
        });

        describe("enabling/disabling", () => {
            describe("enabling Element calls", () => {
                beforeEach(() => {
                    mockPowerLevels({ [ElementCall.MEMBER_EVENT_TYPE.name]: 100 });
                });

                it("enables Element calls in public room", async () => {
                    jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);

                    const tab = renderTab();

                    fireEvent.click(getElementCallSwitch(tab).querySelector(".mx_ToggleSwitch")!);
                    await waitFor(() =>
                        expect(cli.sendStateEvent).toHaveBeenCalledWith(
                            room.roomId,
                            EventType.RoomPowerLevels,
                            expect.objectContaining({
                                events: {
                                    [ElementCall.CALL_EVENT_TYPE.name]: 50,
                                    [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
                                },
                            }),
                        ),
                    );
                });

                it("enables Element calls in private room", async () => {
                    jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);

                    const tab = renderTab();

                    fireEvent.click(getElementCallSwitch(tab).querySelector(".mx_ToggleSwitch")!);
                    await waitFor(() =>
                        expect(cli.sendStateEvent).toHaveBeenCalledWith(
                            room.roomId,
                            EventType.RoomPowerLevels,
                            expect.objectContaining({
                                events: {
                                    [ElementCall.CALL_EVENT_TYPE.name]: 0,
                                    [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
                                },
                            }),
                        ),
                    );
                });
            });

            it("disables Element calls", async () => {
                mockPowerLevels({ [ElementCall.MEMBER_EVENT_TYPE.name]: 0 });

                const tab = renderTab();

                fireEvent.click(getElementCallSwitch(tab).querySelector(".mx_ToggleSwitch")!);
                await waitFor(() =>
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        room.roomId,
                        EventType.RoomPowerLevels,
                        expect.objectContaining({
                            events: {
                                [ElementCall.CALL_EVENT_TYPE.name]: 100,
                                [ElementCall.MEMBER_EVENT_TYPE.name]: 100,
                            },
                        }),
                    ),
                );
            });
        });
    });
});
