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
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { ClientWidgetApi, MatrixWidgetType } from "matrix-widget-api";

import "../../../skinned-sdk";
import { stubClient, mkStubRoom } from "../../../test-utils";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import SettingsStore from "../../../../src/settings/SettingsStore";
import WidgetStore from "../../../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { ElementWidgetActions } from "../../../../src/stores/widgets/ElementWidgetActions";
import VoiceChannelStore, { VoiceChannelEvent } from "../../../../src/stores/VoiceChannelStore";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { VOICE_CHANNEL_ID } from "../../../../src/utils/VoiceChannelUtils";
import { mocked } from "jest-mock";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg  from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, 'get')
        .mockReturnValue({ overrideBrowserShortcuts: () => false } as unknown as BasePlatform);

    const cli = mocked(MatrixClientPeg.get());

    beforeEach(() => {
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, 'getValue').mockImplementation((name, roomId) => {
            if (name === "feature_voice_rooms") {
                return true;
            }
            return realGetValue(name, roomId);
        });

        stubClient();
        DMRoomMap.makeShared();
    });

    describe("voice rooms", () => {
        const room = mkStubRoom("!1:example.org", "voice room", cli);
        room.isCallRoom = () => true;

        // Set up mocks to simulate the remote end of the widget API
        let messageSent;
        let messageSendMock;
        let onceMock;
        beforeEach(() => {
            let resolveMessageSent;
            messageSent = new Promise(resolve => resolveMessageSent = resolve);
            messageSendMock = jest.fn().mockImplementation(() => resolveMessageSent());
            onceMock = jest.fn();

            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([{
                id: VOICE_CHANNEL_ID,
                eventId: "$1:example.org",
                roomId: "!1:example.org",
                type: MatrixWidgetType.JitsiMeet,
                url: "",
                name: "Voice channel",
                creatorUserId: "@alice:example.org",
                avatar_url: null,
            }]);
            jest.spyOn(WidgetMessagingStore.instance, "getMessagingForUid").mockReturnValue({
                on: () => {},
                off: () => {},
                once: onceMock,
                transport: {
                    send: messageSendMock,
                    reply: () => {},
                },
            } as unknown as ClientWidgetApi);
        });

        it("tracks connection state", async () => {
            const tile = mount(
                <RoomTile
                    room={room}
                    showMessagePreview={false}
                    isMinimized={false}
                    tag={DefaultTagID.Untagged}
                />,
            );
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Voice room");

            act(() => { tile.simulate("click"); });
            tile.update();
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Connecting...");

            // Wait for the VoiceChannelStore to connect to the widget API
            await messageSent;
            // Then, locate the callback that will confirm the join
            const [, join] = onceMock.mock.calls.find(([action]) =>
                action === `action:${ElementWidgetActions.JoinCall}`,
            );

            // Now we confirm the join and wait for the VoiceChannelStore to update
            const waitForConnect = new Promise<void>(resolve =>
                VoiceChannelStore.instance.once(VoiceChannelEvent.Connect, resolve),
            );
            join({ detail: {} });
            await waitForConnect;
            // Wait yet another tick for the room tile to update
            await Promise.resolve();

            tile.update();
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Connected");

            // Locate the callback that will perform the hangup
            const [, hangup] = onceMock.mock.calls.find(([action]) =>
                action === `action:${ElementWidgetActions.HangupCall}`,
            );

            // Hangup and wait for the VoiceChannelStore, once again
            const waitForHangup = new Promise<void>(resolve =>
                VoiceChannelStore.instance.once(VoiceChannelEvent.Disconnect, resolve),
            );
            hangup({ detail: {} });
            await waitForHangup;
            // Wait yet another tick for the room tile to update
            await Promise.resolve();

            tile.update();
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Voice room");
        });
    });
});
