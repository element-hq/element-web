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

import { mocked } from "jest-mock";
import { Widget, ClientWidgetApi, MatrixWidgetType, IWidgetApiRequest } from "matrix-widget-api";

import { stubClient, setupAsyncStoreWithClient, mkRoom } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import WidgetStore, { IApp } from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import { ElementWidgetActions } from "../../src/stores/widgets/ElementWidgetActions";
import VideoChannelStore, { VideoChannelEvent } from "../../src/stores/VideoChannelStore";

describe("VideoChannelStore", () => {
    const store = VideoChannelStore.instance;

    const widget = { id: "1" } as unknown as Widget;
    const app = {
        id: "1",
        eventId: "$1:example.org",
        roomId: "!1:example.org",
        type: MatrixWidgetType.JitsiMeet,
        url: "",
        name: "Video channel",
        creatorUserId: "@alice:example.org",
        avatar_url: null,
        data: { isVideoChannel: true },
    } as IApp;

    // Set up mocks to simulate the remote end of the widget API
    let messageSent: Promise<void>;
    let messageSendMock: () => void;
    let onMock: (action: string, listener: (ev: CustomEvent<IWidgetApiRequest>) => void) => void;
    let onceMock: (action: string, listener: (ev: CustomEvent<IWidgetApiRequest>) => void) => void;
    let messaging: ClientWidgetApi;
    beforeEach(() => {
        stubClient();
        const cli = MatrixClientPeg.get();
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, cli);
        setupAsyncStoreWithClient(store, cli);
        mocked(cli).getRoom.mockReturnValue(mkRoom(cli, "!1:example.org"));

        let resolveMessageSent: () => void;
        messageSent = new Promise(resolve => resolveMessageSent = resolve);
        messageSendMock = jest.fn().mockImplementation(() => resolveMessageSent());
        onMock = jest.fn();
        onceMock = jest.fn();

        jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([app]);
        messaging = {
            on: onMock,
            off: () => {},
            stop: () => {},
            once: onceMock,
            transport: {
                send: messageSendMock,
                reply: () => {},
            },
        } as unknown as ClientWidgetApi;
    });

    const widgetReady = () => {
        // Tell the WidgetStore that the widget is ready
        const [, ready] = mocked(onceMock).mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.WidgetReady}`,
        );
        ready({ detail: {} } as unknown as CustomEvent<IWidgetApiRequest>);
    };

    const confirmConnect = async () => {
        // Wait for the store to contact the widget API
        await messageSent;
        // Then, locate the callback that will confirm the join
        const [, join] = mocked(onMock).mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.JoinCall}`,
        );
        // Confirm the join, and wait for the store to update
        const waitForConnect = new Promise<void>(resolve =>
            store.once(VideoChannelEvent.Connect, resolve),
        );
        join({ detail: {} } as unknown as CustomEvent<IWidgetApiRequest>);
        await waitForConnect;
    };

    const confirmDisconnect = async () => {
        // Locate the callback that will perform the hangup
        const [, hangup] = mocked(onceMock).mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.HangupCall}`,
        );
        // Hangup and wait for the store, once again
        const waitForHangup = new Promise<void>(resolve =>
            store.once(VideoChannelEvent.Disconnect, resolve),
        );
        hangup({ detail: {} } as unknown as CustomEvent<IWidgetApiRequest>);
        await waitForHangup;
    };

    it("connects and disconnects", async () => {
        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);

        const connectPromise = store.connect("!1:example.org", null, null);
        await confirmConnect();
        await expect(connectPromise).resolves.toBeUndefined();
        expect(store.roomId).toEqual("!1:example.org");
        expect(store.connected).toEqual(true);

        const disconnectPromise = store.disconnect();
        await confirmDisconnect();
        await expect(disconnectPromise).resolves.toBeUndefined();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");
    });

    it("waits for messaging when connecting", async () => {
        const connectPromise = store.connect("!1:example.org", null, null);
        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        await confirmConnect();
        await expect(connectPromise).resolves.toBeUndefined();
        expect(store.roomId).toEqual("!1:example.org");
        expect(store.connected).toEqual(true);

        store.disconnect();
        await confirmDisconnect();
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");
    });

    it("rejects if the widget's messaging gets stopped mid-connect", async () => {
        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);

        const connectPromise = store.connect("!1:example.org", null, null);
        // Wait for the store to contact the widget API, then stop the messaging
        await messageSent;
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");
        await expect(connectPromise).rejects.toBeDefined();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);
    });
});
