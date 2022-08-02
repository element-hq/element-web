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
// eslint-disable-next-line deprecate/import
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
import { STUCK_DEVICE_TIMEOUT_MS } from "../../../../src/utils/VideoChannelUtils";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";

const mockGetMember = (room: Room, getMembership: (userId: string) => string = () => "join") => {
    mocked(room).getMember.mockImplementation(userId => ({
        userId,
        membership: getMembership(userId),
        name: userId,
        rawDisplayName: userId,
        roomId: "!1:example.org",
        getAvatarUrl: () => {},
        getMxcAvatarUrl: () => {},
    }) as unknown as RoomMember);
};

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

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe("video rooms", () => {
        let room: Room;
        beforeEach(() => {
            room = mkRoom(cli, "!1:example.org");
            mocked(room.isElementVideoRoom).mockReturnValue(true);
        });

        const mountTile = () => mount(
            <RoomTile
                room={room}
                showMessagePreview={false}
                isMinimized={false}
                tag={DefaultTagID.Untagged}
            />,
        );

        it("tracks connection state", () => {
            const tile = mountTile();
            expect(tile.find(".mx_VideoRoomSummary_indicator").text()).toEqual("Video");

            act(() => { store.startConnect("!1:example.org"); });
            tile.update();
            expect(tile.find(".mx_VideoRoomSummary_indicator").text()).toEqual("Joining…");

            act(() => { store.connect("!1:example.org"); });
            tile.update();
            expect(tile.find(".mx_VideoRoomSummary_indicator").text()).toEqual("Joined");

            act(() => { store.disconnect(); });
            tile.update();
            expect(tile.find(".mx_VideoRoomSummary_indicator").text()).toEqual("Video");
        });

        it("displays connected members", () => {
            mockGetMember(room, userId => userId === "@chris:example.org" ? "leave" : "join");
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // A user connected from 2 devices
                mkVideoChannelMember("@alice:example.org", ["device 1", "device 2"]),
                // A disconnected user
                mkVideoChannelMember("@bob:example.org", []),
                // A user that claims to have a connected device, but has left the room
                mkVideoChannelMember("@chris:example.org", ["device 1"]),
            ]));

            const tile = mountTile();

            // Only Alice should display as connected
            expect(tile.find(".mx_VideoRoomSummary_participants").text()).toEqual("1");
        });

        it("reflects local echo in connected members", () => {
            mockGetMember(room);
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // Make the remote echo claim that we're connected, while leaving the store disconnected
                mkVideoChannelMember(cli.getUserId(), [cli.getDeviceId()]),
            ]));

            const tile = mountTile();

            // Because of our local echo, we should still appear as disconnected
            expect(tile.find(".mx_VideoRoomSummary_participants").exists()).toEqual(false);
        });

        it("doesn't count members whose device data has expired", () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            mockGetMember(room);
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                mkVideoChannelMember("@alice:example.org", ["device 1"], STUCK_DEVICE_TIMEOUT_MS),
            ]));

            const tile = mountTile();

            expect(tile.find(".mx_VideoRoomSummary_participants").text()).toEqual("1");
            // Expire Alice's device data
            act(() => { jest.advanceTimersByTime(STUCK_DEVICE_TIMEOUT_MS); });
            tile.update();
            expect(tile.find(".mx_VideoRoomSummary_participants").exists()).toEqual(false);
        });
    });
});
