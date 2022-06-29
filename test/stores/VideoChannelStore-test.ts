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

import { mocked, Mocked } from "jest-mock";
import {
    Widget,
    ClientWidgetApi,
    MatrixWidgetType,
    WidgetApiAction,
    IWidgetApiRequest,
    IWidgetApiRequestData,
} from "matrix-widget-api";
import { MatrixClient } from "matrix-js-sdk/src/client";

import { stubClient, setupAsyncStoreWithClient, mkRoom } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import WidgetStore, { IApp } from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../src/stores/widgets/ElementWidgetActions";
import { VIDEO_CHANNEL_MEMBER, STUCK_DEVICE_TIMEOUT_MS } from "../../src/utils/VideoChannelUtils";
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
    let sendMock: (action: WidgetApiAction, data: IWidgetApiRequestData) => void;
    let onMock: (action: string, listener: (ev: CustomEvent<IWidgetApiRequest>) => void) => void;
    let onceMock: (action: string, listener: (ev: CustomEvent<IWidgetApiRequest>) => void) => void;
    let messaging: ClientWidgetApi;
    let cli: Mocked<MatrixClient>;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.get());
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, cli);
        setupAsyncStoreWithClient(store, cli);
        cli.getRoom.mockReturnValue(mkRoom(cli, "!1:example.org"));

        sendMock = jest.fn();
        onMock = jest.fn();
        onceMock = jest.fn();

        jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([app]);
        messaging = {
            on: onMock,
            off: () => {},
            stop: () => {},
            once: onceMock,
            transport: {
                send: sendMock,
                reply: () => {},
            },
        } as unknown as ClientWidgetApi;
    });

    afterEach(() => jest.useRealTimers());

    const getRequest = <T extends IWidgetApiRequestData>(): Promise<[WidgetApiAction, T]> =>
        new Promise<[WidgetApiAction, T]>(resolve => {
            mocked(sendMock).mockImplementationOnce((action, data) => resolve([action, data as T]));
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
        await getRequest();
        // Then, locate the callback that will confirm the join
        const [, join] = mocked(onMock).mock.calls.find(([action]) =>
            action === `action:${ElementWidgetActions.JoinCall}`,
        );
        // Confirm the join, and wait for the store to update
        const waitForConnect = new Promise<void>(resolve =>
            store.once(VideoChannelEvent.Connect, resolve),
        );
        join(new CustomEvent("widgetapirequest", { detail: {} }) as CustomEvent<IWidgetApiRequest>);
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
        hangup(new CustomEvent("widgetapirequest", { detail: {} }) as CustomEvent<IWidgetApiRequest>);
        await waitForHangup;
    };

    it("connects and disconnects", async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);

        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);

        const connectConfirmed = confirmConnect();
        const connectPromise = store.connect("!1:example.org", null, null);
        await connectConfirmed;
        await expect(connectPromise).resolves.toBeUndefined();
        expect(store.roomId).toEqual("!1:example.org");
        expect(store.connected).toEqual(true);

        // Our device should now appear as connected
        expect(cli.sendStateEvent).toHaveBeenLastCalledWith(
            "!1:example.org",
            VIDEO_CHANNEL_MEMBER,
            { devices: [cli.getDeviceId()], expires_ts: expect.any(Number) },
            cli.getUserId(),
        );
        cli.sendStateEvent.mockClear();

        // Our devices should be resent within the timeout period to prevent
        // the data from becoming stale
        jest.advanceTimersByTime(STUCK_DEVICE_TIMEOUT_MS);
        expect(cli.sendStateEvent).toHaveBeenLastCalledWith(
            "!1:example.org",
            VIDEO_CHANNEL_MEMBER,
            { devices: [cli.getDeviceId()], expires_ts: expect.any(Number) },
            cli.getUserId(),
        );
        cli.sendStateEvent.mockClear();

        const disconnectPromise = store.disconnect();
        await confirmDisconnect();
        await expect(disconnectPromise).resolves.toBeUndefined();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");

        // Our device should now be marked as disconnected
        expect(cli.sendStateEvent).toHaveBeenLastCalledWith(
            "!1:example.org",
            VIDEO_CHANNEL_MEMBER,
            { devices: [], expires_ts: expect.any(Number) },
            cli.getUserId(),
        );
    });

    it("waits for messaging when connecting", async () => {
        const connectConfirmed = confirmConnect();
        const connectPromise = store.connect("!1:example.org", null, null);
        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        await connectConfirmed;
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

        const requestPromise = getRequest();
        const connectPromise = store.connect("!1:example.org", null, null);
        // Wait for the store to contact the widget API, then stop the messaging
        await requestPromise;
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");
        await expect(connectPromise).rejects.toBeDefined();
        expect(store.roomId).toBeFalsy();
        expect(store.connected).toEqual(false);
    });

    it("switches to spotlight mode when the widget becomes a PiP", async () => {
        WidgetMessagingStore.instance.storeMessaging(widget, "!1:example.org", messaging);
        widgetReady();
        confirmConnect();
        await store.connect("!1:example.org", null, null);

        const request = getRequest<IWidgetApiRequestData>();
        ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Undock);
        const [action, data] = await request;
        expect(action).toEqual(ElementWidgetActions.SpotlightLayout);
        expect(data).toEqual({});

        store.disconnect();
        await confirmDisconnect();
        WidgetMessagingStore.instance.stopMessaging(widget, "!1:example.org");
    });
});
