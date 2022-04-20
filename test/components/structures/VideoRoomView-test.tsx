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
import { MatrixWidgetType } from "matrix-widget-api";

import { stubClient, stubVideoChannelStore, mkRoom, wrapInMatrixClientContext } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { VIDEO_CHANNEL } from "../../../src/utils/VideoChannelUtils";
import WidgetStore from "../../../src/stores/WidgetStore";
import _VideoRoomView from "../../../src/components/structures/VideoRoomView";
import VideoLobby from "../../../src/components/views/voip/VideoLobby";
import AppTile from "../../../src/components/views/elements/AppTile";

const VideoRoomView = wrapInMatrixClientContext(_VideoRoomView);

describe("VideoRoomView", () => {
    stubClient();
    jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([{
        id: VIDEO_CHANNEL,
        eventId: "$1:example.org",
        roomId: "!1:example.org",
        type: MatrixWidgetType.JitsiMeet,
        url: "https://example.org",
        name: "Video channel",
        creatorUserId: "@alice:example.org",
        avatar_url: null,
    }]);
    Object.defineProperty(navigator, "mediaDevices", {
        value: { enumerateDevices: () => [] },
    });

    const cli = MatrixClientPeg.get();
    const room = mkRoom(cli, "!1:example.org");

    let store;
    beforeEach(() => {
        store = stubVideoChannelStore();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("shows lobby and keeps widget loaded when disconnected", async () => {
        const view = mount(<VideoRoomView room={room} resizing={false} />);
        // Wait for state to settle
        await act(async () => Promise.resolve());

        expect(view.find(VideoLobby).exists()).toEqual(true);
        expect(view.find(AppTile).exists()).toEqual(true);
    });

    it("only shows widget when connected", async () => {
        store.connect("!1:example.org");
        const view = mount(<VideoRoomView room={room} resizing={false} />);
        // Wait for state to settle
        await act(async () => Promise.resolve());

        expect(view.find(VideoLobby).exists()).toEqual(false);
        expect(view.find(AppTile).exists()).toEqual(true);
    });
});
