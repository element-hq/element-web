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
import { MatrixClient, IMyDevice } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixWidgetType } from "matrix-widget-api";

import {
    stubClient,
    stubVideoChannelStore,
    StubVideoChannelStore,
    mkRoom,
    wrapInMatrixClientContext,
    mockStateEventImplementation,
    mkVideoChannelMember,
} from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { VIDEO_CHANNEL_MEMBER } from "../../../src/utils/VideoChannelUtils";
import WidgetStore from "../../../src/stores/WidgetStore";
import _VideoRoomView from "../../../src/components/structures/VideoRoomView";
import VideoLobby from "../../../src/components/views/voip/VideoLobby";
import AppTile from "../../../src/components/views/elements/AppTile";

const VideoRoomView = wrapInMatrixClientContext(_VideoRoomView);

describe("VideoRoomView", () => {
    jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([{
        id: "1",
        eventId: "$1:example.org",
        roomId: "!1:example.org",
        type: MatrixWidgetType.JitsiMeet,
        url: "https://example.org",
        name: "Video channel",
        creatorUserId: "@alice:example.org",
        avatar_url: null,
        data: { isVideoChannel: true },
    }]);
    Object.defineProperty(navigator, "mediaDevices", {
        value: { enumerateDevices: () => [] },
    });

    let cli: MatrixClient;
    let room: Room;
    let store: StubVideoChannelStore;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();
        jest.spyOn(WidgetStore.instance, "matrixClient", "get").mockReturnValue(cli);
        store = stubVideoChannelStore();
        room = mkRoom(cli, "!1:example.org");
    });

    it("removes stuck devices on mount", async () => {
        // Simulate an unclean disconnect
        store.roomId = "!1:example.org";

        const devices: IMyDevice[] = [
            {
                device_id: cli.getDeviceId(),
                last_seen_ts: new Date().valueOf(),
            },
            {
                device_id: "went offline 2 hours ago",
                last_seen_ts: new Date().valueOf() - 1000 * 60 * 60 * 2,
            },
        ];
        mocked(cli).getDevices.mockResolvedValue({ devices });

        // Make both devices be stuck
        mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
            mkVideoChannelMember(cli.getUserId(), devices.map(d => d.device_id)),
        ]));

        mount(<VideoRoomView room={room} resizing={false} />);
        // Wait for state to settle
        await act(() => Promise.resolve());

        // All devices should have been removed
        expect(cli.sendStateEvent).toHaveBeenLastCalledWith(
            "!1:example.org", VIDEO_CHANNEL_MEMBER, { devices: [] }, cli.getUserId(),
        );
    });

    it("shows lobby and keeps widget loaded when disconnected", async () => {
        const view = mount(<VideoRoomView room={room} resizing={false} />);
        // Wait for state to settle
        await act(() => Promise.resolve());

        expect(view.find(VideoLobby).exists()).toEqual(true);
        expect(view.find(AppTile).exists()).toEqual(true);
    });

    it("only shows widget when connected", async () => {
        store.connect("!1:example.org");
        const view = mount(<VideoRoomView room={room} resizing={false} />);
        // Wait for state to settle
        await act(() => Promise.resolve());

        expect(view.find(VideoLobby).exists()).toEqual(false);
        expect(view.find(AppTile).exists()).toEqual(true);
    });
});
