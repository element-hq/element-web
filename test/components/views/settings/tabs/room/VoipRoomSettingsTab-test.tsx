/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { fireEvent, render, RenderResult, waitFor } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";

import { mkStubRoom, stubClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { VoipRoomSettingsTab } from "../../../../../../src/components/views/settings/tabs/room/VoipRoomSettingsTab";
import { ElementCall } from "../../../../../../src/models/Call";

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
