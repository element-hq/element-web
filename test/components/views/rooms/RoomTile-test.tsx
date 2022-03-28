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
import { mocked } from "jest-mock";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import {
    stubClient,
    mockStateEventImplementation,
    mkRoom,
    mkEvent,
    stubVoiceChannelStore,
} from "../../../test-utils";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import MemberAvatar from "../../../../src/components/views/avatars/MemberAvatar";
import SettingsStore from "../../../../src/settings/SettingsStore";
import VoiceChannelStore, { VoiceChannelEvent } from "../../../../src/stores/VoiceChannelStore";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { VOICE_CHANNEL_MEMBER } from "../../../../src/utils/VoiceChannelUtils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";

const mkVoiceChannelMember = (userId: string, devices: string[]): MatrixEvent => mkEvent({
    event: true,
    type: VOICE_CHANNEL_MEMBER,
    room: "!1:example.org",
    user: userId,
    skey: userId,
    content: { devices },
});

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, 'get')
        .mockReturnValue({ overrideBrowserShortcuts: () => false } as unknown as BasePlatform);

    let cli;
    let store;

    beforeEach(() => {
        const realGetValue = SettingsStore.getValue;
        SettingsStore.getValue = <T, >(name: string, roomId?: string): T => {
            if (name === "feature_voice_rooms") {
                return true as unknown as T;
            }
            return realGetValue(name, roomId);
        };

        stubClient();
        stubVoiceChannelStore();
        DMRoomMap.makeShared();

        cli = mocked(MatrixClientPeg.get());
        store = VoiceChannelStore.instance;
    });

    afterEach(() => jest.clearAllMocks());

    describe("voice rooms", () => {
        const room = mkRoom(cli, "!1:example.org");
        room.isCallRoom.mockReturnValue(true);

        it("tracks connection state", async () => {
            // Insert a breakpoint in the connect method, so we can see the intermediate connecting state
            let continueJoin;
            const breakpoint = new Promise(resolve => continueJoin = resolve);
            const realConnect = store.connect;
            store.connect = async () => {
                await breakpoint;
                await realConnect();
            };

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

            // Now we confirm the join and wait for the store to update
            const waitForConnect = new Promise<void>(resolve =>
                store.once(VoiceChannelEvent.Connect, resolve),
            );
            continueJoin();
            await waitForConnect;
            // Wait exactly 2 ticks for the room tile to update
            await Promise.resolve();
            await Promise.resolve();

            tile.update();
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Connected");

            await store.disconnect();

            tile.update();
            expect(tile.find(".mx_RoomTile_voiceIndicator").text()).toEqual("Voice room");
        });

        it("displays connected members", async () => {
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // A user connected from 2 devices
                mkVoiceChannelMember("@alice:example.org", ["device 1", "device 2"]),
                // A disconnected user
                mkVoiceChannelMember("@bob:example.org", []),
                // A user that claims to have a connected device, but has left the room
                mkVoiceChannelMember("@chris:example.org", ["device 1"]),
            ]));

            mocked(room.currentState).getMember.mockImplementation(userId => ({
                userId,
                membership: userId === "@chris:example.org" ? "leave" : "join",
                name: userId,
                rawDisplayName: userId,
                roomId: "!1:example.org",
                getAvatarUrl: () => {},
                getMxcAvatarUrl: () => {},
            }) as unknown as RoomMember);

            const tile = mount(
                <RoomTile
                    room={room}
                    showMessagePreview={false}
                    isMinimized={false}
                    tag={DefaultTagID.Untagged}
                />,
            );

            // Only Alice should display as connected
            const avatar = tile.find(MemberAvatar);
            expect(avatar.length).toEqual(1);
            expect(avatar.props().member.userId).toEqual("@alice:example.org");
        });
    });
});
