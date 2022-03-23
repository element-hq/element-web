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

import { stubClient } from "../test-utils";
import WidgetStore from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import { ElementWidgetActions } from "../../src/stores/widgets/ElementWidgetActions";
import VoiceChannelStore, { VoiceChannelEvent } from "../../src/stores/VoiceChannelStore";
import { VOICE_CHANNEL } from "../../src/utils/VoiceChannelUtils";

describe("VoiceChannelStore", () => {
    // Set up mocks to simulate the remote end of the widget API
    let messageSent;
    let messageSendMock;
    let onceMock;
    beforeEach(() => {
        stubClient();
        let resolveMessageSent;
        messageSent = new Promise(resolve => resolveMessageSent = resolve);
        messageSendMock = jest.fn().mockImplementation(() => resolveMessageSent());
        onceMock = jest.fn();

        jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([{
            id: VOICE_CHANNEL,
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

    it("connects and disconnects", async () => {
        const store = VoiceChannelStore.instance;

        expect(store.roomId).toBeFalsy();

        store.connect("!1:example.org");
        // Wait for the store to contact the widget API
        await messageSent;
        // Then, locate the callback that will confirm the join
        const [, join] = onceMock.mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.JoinCall}`,
        );
        // Confirm the join, and wait for the store to update
        const waitForConnect = new Promise<void>(resolve =>
            store.once(VoiceChannelEvent.Connect, resolve),
        );
        join({ detail: {} });
        await waitForConnect;

        expect(store.roomId).toEqual("!1:example.org");

        store.disconnect();
        // Locate the callback that will perform the hangup
        const [, hangup] = onceMock.mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.HangupCall}`,
        );
        // Hangup and wait for the store, once again
        const waitForHangup = new Promise<void>(resolve =>
            store.once(VoiceChannelEvent.Disconnect, resolve),
        );
        hangup({ detail: {} });
        await waitForHangup;

        expect(store.roomId).toBeFalsy();
    });
});
