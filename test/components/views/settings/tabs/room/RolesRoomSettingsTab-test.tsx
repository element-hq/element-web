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
import { EventType, MatrixClient } from "matrix-js-sdk/src/matrix";

import RolesRoomSettingsTab from "../../../../../../src/components/views/settings/tabs/room/RolesRoomSettingsTab";
import { mkStubRoom, stubClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { VoiceBroadcastInfoEventType } from "../../../../../../src/voice-broadcast";

describe("RolesRoomSettingsTab", () => {
    const roomId = "!room:example.com";
    let rolesRoomSettingsTab: RenderResult;
    let cli: MatrixClient;

    const getVoiceBroadcastsSelect = () => {
        return rolesRoomSettingsTab.container.querySelector("select[label='Voice broadcasts']");
    };

    const getVoiceBroadcastsSelectedOption = () => {
        return rolesRoomSettingsTab.container.querySelector("select[label='Voice broadcasts'] option:checked");
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();
        rolesRoomSettingsTab = render(<RolesRoomSettingsTab roomId={roomId} />);
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
});
