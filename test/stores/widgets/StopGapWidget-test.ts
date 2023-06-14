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
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { MatrixClient, ClientEvent } from "matrix-js-sdk/src/client";
import { ClientWidgetApi } from "matrix-widget-api";

import { stubClient, mkRoom, mkEvent } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { StopGapWidget } from "../../../src/stores/widgets/StopGapWidget";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";
import { VoiceBroadcastInfoEventType, VoiceBroadcastRecording } from "../../../src/voice-broadcast";
import { SdkContextClass } from "../../../src/contexts/SDKContext";

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
                url: "https://example.org?user-id=$matrix_user_id&device-id=$org.matrix.msc3819.matrix_device_id",
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
        expect(widget.embedUrl).toBe(
            "https://example.org/?user-id=%40userId%3Amatrix.org&device-id=ABCDEFGHI&widgetId=test&parentUrl=http%3A%2F%2Flocalhost%2F",
        );
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
