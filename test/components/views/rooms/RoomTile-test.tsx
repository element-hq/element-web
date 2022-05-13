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
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import {
    stubClient,
    mockStateEventImplementation,
    mkRoom,
    mkVideoChannelMember,
    stubVideoChannelStore,
    StubVideoChannelStore,
} from "../../../test-utils";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, 'get')
        .mockReturnValue({ overrideBrowserShortcuts: () => false } as unknown as BasePlatform);

    let cli: MatrixClient;
    let store: StubVideoChannelStore;
    beforeEach(() => {
        const realGetValue = SettingsStore.getValue;
        SettingsStore.getValue = <T, >(name: string, roomId?: string): T => {
            if (name === "feature_video_rooms") {
                return true as unknown as T;
            }
            return realGetValue(name, roomId);
        };

        stubClient();
        cli = MatrixClientPeg.get();
        store = stubVideoChannelStore();
        DMRoomMap.makeShared();
    });

    afterEach(() => jest.clearAllMocks());

    describe("video rooms", () => {
        let room: Room;
        beforeEach(() => {
            room = mkRoom(cli, "!1:example.org");
            mocked(room.isElementVideoRoom).mockReturnValue(true);
        });

        it("tracks connection state", () => {
            const tile = mount(
                <RoomTile
                    room={room}
                    showMessagePreview={false}
                    isMinimized={false}
                    tag={DefaultTagID.Untagged}
                />,
            );
            expect(tile.find(".mx_RoomTile_videoIndicator").text()).toEqual("Video");

            act(() => { store.startConnect("!1:example.org"); });
            tile.update();
            expect(tile.find(".mx_RoomTile_videoIndicator").text()).toEqual("Joining…");

            act(() => { store.connect("!1:example.org"); });
            tile.update();
            expect(tile.find(".mx_RoomTile_videoIndicator").text()).toEqual("Joined");

            act(() => { store.disconnect(); });
            tile.update();
            expect(tile.find(".mx_RoomTile_videoIndicator").text()).toEqual("Video");
        });

        it("displays connected members", () => {
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // A user connected from 2 devices
                mkVideoChannelMember("@alice:example.org", ["device 1", "device 2"]),
                // A disconnected user
                mkVideoChannelMember("@bob:example.org", []),
                // A user that claims to have a connected device, but has left the room
                mkVideoChannelMember("@chris:example.org", ["device 1"]),
            ]));

            mocked(room).getMember.mockImplementation(userId => ({
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
            expect(tile.find(".mx_RoomTile_videoParticipants").text()).toEqual("1");
        });

        it("reflects local echo in connected members", () => {
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // Make the remote echo claim that we're connected, while leaving the store disconnected
                mkVideoChannelMember(cli.getUserId(), [cli.getDeviceId()]),
            ]));

            mocked(room).getMember.mockImplementation(userId => ({
                userId,
                membership: "join",
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

            // Because of our local echo, we should still appear as disconnected
            expect(tile.find(".mx_RoomTile_videoParticipants").exists()).toEqual(false);
        });
    });
});
