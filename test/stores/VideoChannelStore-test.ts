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

import { ClientWidgetApi, MatrixWidgetType } from "matrix-widget-api";

import "../skinned-sdk";
import { stubClient, mkRoom } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import WidgetStore from "../../src/stores/WidgetStore";
import ActiveWidgetStore from "../../src/stores/ActiveWidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import VideoChannelStore, { VideoChannelEvent } from "../../src/stores/VideoChannelStore";
import { VIDEO_CHANNEL } from "../../src/utils/VideoChannelUtils";

describe("VideoChannelStore", () => {
    stubClient();
    mkRoom(MatrixClientPeg.get(), "!1:example.org");

    const videoStore = VideoChannelStore.instance;
    const widgetStore = ActiveWidgetStore.instance;

    jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([{
        id: VIDEO_CHANNEL,
        eventId: "$1:example.org",
        roomId: "!1:example.org",
        type: MatrixWidgetType.JitsiMeet,
        url: "",
        name: "Video channel",
        creatorUserId: "@alice:example.org",
        avatar_url: null,
    }]);
    jest.spyOn(WidgetMessagingStore.instance, "getMessagingForUid").mockReturnValue({
        on: () => {},
        off: () => {},
        once: () => {},
        transport: {
            send: () => {},
            reply: () => {},
        },
    } as unknown as ClientWidgetApi);

    beforeEach(() => {
        videoStore.start();
    });

    afterEach(() => {
        videoStore.stop();
        jest.clearAllMocks();
    });

    it("tracks connection state", async () => {
        expect(videoStore.roomId).toBeFalsy();

        const waitForConnect = new Promise<void>(resolve =>
            videoStore.once(VideoChannelEvent.Connect, resolve),
        );
        widgetStore.setWidgetPersistence(VIDEO_CHANNEL, "!1:example.org", true);
        await waitForConnect;

        expect(videoStore.roomId).toEqual("!1:example.org");

        const waitForDisconnect = new Promise<void>(resolve =>
            videoStore.once(VideoChannelEvent.Disconnect, resolve),
        );
        widgetStore.setWidgetPersistence(VIDEO_CHANNEL, "!1:example.org", false);
        await waitForDisconnect;

        expect(videoStore.roomId).toBeFalsy();
    });
});
