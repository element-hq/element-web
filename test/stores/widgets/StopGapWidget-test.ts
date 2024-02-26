/*
Copyright 2022 The Matrix.org Foundation C.I.C

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

import { mocked, MockedObject } from "jest-mock";
import { last } from "lodash";
import { MatrixEvent, MatrixClient, ClientEvent } from "matrix-js-sdk/src/matrix";
import { ClientWidgetApi, WidgetApiFromWidgetAction } from "matrix-widget-api";
import { waitFor } from "@testing-library/react";

import { stubClient, mkRoom, mkEvent } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { StopGapWidget } from "../../../src/stores/widgets/StopGapWidget";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";
import { VoiceBroadcastInfoEventType, VoiceBroadcastRecording } from "../../../src/voice-broadcast";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import ActiveWidgetStore from "../../../src/stores/ActiveWidgetStore";
import SettingsStore from "../../../src/settings/SettingsStore";

jest.mock("matrix-widget-api/lib/ClientWidgetApi");

describe("StopGapWidget", () => {
    let client: MockedObject<MatrixClient>;
    let widget: StopGapWidget;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        widget = new StopGapWidget({
            app: {
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url&theme=$org.matrix.msc2873.client_theme",
                roomId: "!1:example.org",
            },
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.startMessaging(null as unknown as HTMLIFrameElement);
        messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
    });

    afterEach(() => {
        widget.stopMessaging();
    });

    it("should replace parameters in widget url template", () => {
        const originGetValue = SettingsStore.getValue;
        const spy = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === "theme") return "my-theme-for-testing";
            return originGetValue(setting);
        });
        expect(widget.embedUrl).toBe(
            "https://example.org/?user-id=%40userId%3Amatrix.org&device-id=ABCDEFGHI&base-url=https%3A%2F%2Fmatrix-client.matrix.org&theme=my-theme-for-testing&widgetId=test&parentUrl=http%3A%2F%2Flocalhost%2F",
        );
        spy.mockClear();
    });

    it("feeds incoming to-device messages to the widget", async () => {
        const event = mkEvent({
            event: true,
            type: "org.example.foo",
            user: "@alice:example.org",
            content: { hello: "world" },
        });

        client.emit(ClientEvent.ToDeviceEvent, event);
        await Promise.resolve(); // flush promises
        expect(messaging.feedToDevice).toHaveBeenCalledWith(event.getEffectiveEvent(), false);
    });

    describe("when there is a voice broadcast recording", () => {
        let voiceBroadcastInfoEvent: MatrixEvent;
        let voiceBroadcastRecording: VoiceBroadcastRecording;

        beforeEach(() => {
            voiceBroadcastInfoEvent = mkEvent({
                event: true,
                room: client.getRoom("x")?.roomId,
                user: client.getUserId()!,
                type: VoiceBroadcastInfoEventType,
                content: {},
            });
            voiceBroadcastRecording = new VoiceBroadcastRecording(voiceBroadcastInfoEvent, client);
            jest.spyOn(voiceBroadcastRecording, "pause");
            jest.spyOn(SdkContextClass.instance.voiceBroadcastRecordingsStore, "getCurrent").mockReturnValue(
                voiceBroadcastRecording,
            );
        });

        describe(`and receiving a action:${ElementWidgetActions.JoinCall} message`, () => {
            beforeEach(async () => {
                messaging.on.mock.calls.find(([event, listener]) => {
                    if (event === `action:${ElementWidgetActions.JoinCall}`) {
                        listener();
                        return true;
                    }
                });
            });

            it("should pause the current voice broadcast recording", () => {
                expect(voiceBroadcastRecording.pause).toHaveBeenCalled();
            });
        });
    });
});
describe("StopGapWidget with stickyPromise", () => {
    let client: MockedObject<MatrixClient>;
    let widget: StopGapWidget;
    let messaging: MockedObject<ClientWidgetApi>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
    });

    afterEach(() => {
        widget.stopMessaging();
    });
    it("should wait for the sticky promise to resolve before starting messaging", async () => {
        jest.useFakeTimers();
        const getStickyPromise = async () => {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        };
        widget = new StopGapWidget({
            app: {
                id: "test",
                creatorUserId: "@alice:example.org",
                type: "example",
                url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id&base-url=$org.matrix.msc4039.matrix_base_url",
                roomId: "!1:example.org",
            },
            room: mkRoom(client, "!1:example.org"),
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
            stickyPromise: getStickyPromise,
        });

        const setPersistenceSpy = jest.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence");

        // Start messaging without an iframe, since ClientWidgetApi is mocked
        widget.startMessaging(null as unknown as HTMLIFrameElement);
        const emitSticky = async () => {
            messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
            messaging?.hasCapability.mockReturnValue(true);
            // messaging.transport.reply will be called but transport is undefined in this test environment
            // This just makes sure the call doesn't throw
            Object.defineProperty(messaging, "transport", { value: { reply: () => {} } });
            messaging.on.mock.calls.find(([event, listener]) => {
                if (event === `action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`) {
                    listener({ preventDefault: () => {}, detail: { data: { value: true } } });
                    return true;
                }
            });
        };
        await emitSticky();
        expect(setPersistenceSpy).not.toHaveBeenCalled();
        // Advance the fake timer so that the sticky promise resolves
        jest.runAllTimers();
        // Use a real timer and wait for the next tick so the sticky promise can resolve
        jest.useRealTimers();

        waitFor(() => expect(setPersistenceSpy).toHaveBeenCalled(), { interval: 5 });
    });
});
