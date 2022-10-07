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
import { fireEvent, render, RenderResult } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { EventType } from "matrix-js-sdk/src/@types/event";

import RolesRoomSettingsTab from "../../../../../../src/components/views/settings/tabs/room/RolesRoomSettingsTab";
import { mkStubRoom, stubClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { VoiceBroadcastInfoEventType } from "../../../../../../src/voice-broadcast";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { ElementCall } from "../../../../../../src/models/Call";

describe("RolesRoomSettingsTab", () => {
    const roomId = "!room:example.com";
    let cli: MatrixClient;

    const renderTab = (): RenderResult => {
        return render(<RolesRoomSettingsTab roomId={roomId} />);
    };

    const getVoiceBroadcastsSelect = () => {
        return renderTab().container.querySelector("select[label='Voice broadcasts']");
    };

    const getVoiceBroadcastsSelectedOption = () => {
        return renderTab().container.querySelector("select[label='Voice broadcasts'] option:checked");
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();
        mkStubRoom(roomId, "test room", cli);
    });

    it("should initially show »Moderator« permission for »Voice broadcasts«", () => {
        expect(getVoiceBroadcastsSelectedOption().textContent).toBe("Moderator");
    });

    describe("when setting »Default« permission for »Voice broadcasts«", () => {
        beforeEach(() => {
            fireEvent.change(getVoiceBroadcastsSelect(), {
                target: { value: 0 },
            });
        });

        it("should update the power levels", () => {
            expect(cli.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPowerLevels,
                {
                    events: {
                        [VoiceBroadcastInfoEventType]: 0,
                    },
                },
            );
        });
    });

    describe("Element Call", () => {
        const setGroupCallsEnabled = (val: boolean): void => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                if (name === "feature_group_calls") return val;
            });
        };

        const getStartCallSelect = (tab: RenderResult) => {
            return tab.container.querySelector("select[label='Start Element Call calls']");
        };

        const getStartCallSelectedOption = (tab: RenderResult) => {
            return tab.container.querySelector("select[label='Start Element Call calls'] option:checked");
        };

        const getJoinCallSelect = (tab: RenderResult) => {
            return tab.container.querySelector("select[label='Join Element Call calls']");
        };

        const getJoinCallSelectedOption = (tab: RenderResult) => {
            return tab.container.querySelector("select[label='Join Element Call calls'] option:checked");
        };

        describe("Element Call enabled", () => {
            beforeEach(() => {
                setGroupCallsEnabled(true);
            });

            describe("Join Element calls", () => {
                it("defaults to moderator for joining calls", () => {
                    expect(getJoinCallSelectedOption(renderTab())?.textContent).toBe("Moderator");
                });

                it("can change joining calls power level", () => {
                    const tab = renderTab();

                    fireEvent.change(getJoinCallSelect(tab), {
                        target: { value: 0 },
                    });

                    expect(getJoinCallSelectedOption(tab)?.textContent).toBe("Default");
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        roomId,
                        EventType.RoomPowerLevels,
                        {
                            events: {
                                [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
                            },
                        },
                    );
                });
            });

            describe("Start Element calls", () => {
                it("defaults to moderator for starting calls", () => {
                    expect(getStartCallSelectedOption(renderTab())?.textContent).toBe("Moderator");
                });

                it("can change starting calls power level", () => {
                    const tab = renderTab();

                    fireEvent.change(getStartCallSelect(tab), {
                        target: { value: 0 },
                    });

                    expect(getStartCallSelectedOption(tab)?.textContent).toBe("Default");
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(
                        roomId,
                        EventType.RoomPowerLevels,
                        {
                            events: {
                                [ElementCall.CALL_EVENT_TYPE.name]: 0,
                            },
                        },
                    );
                });
            });
        });

        it("hides when group calls disabled", () => {
            setGroupCallsEnabled(false);

            const tab = renderTab();

            expect(getStartCallSelect(tab)).toBeFalsy();
            expect(getStartCallSelectedOption(tab)).toBeFalsy();

            expect(getJoinCallSelect(tab)).toBeFalsy();
            expect(getJoinCallSelectedOption(tab)).toBeFalsy();
        });
    });
});
