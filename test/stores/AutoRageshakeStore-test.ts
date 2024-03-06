/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import {
    ClientEvent,
    EventType,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    SyncState,
} from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../src/settings/SettingsStore";
import AutoRageshakeStore from "../../src/stores/AutoRageshakeStore";
import { mkEvent, stubClient } from "../test-utils";

jest.mock("../../src/rageshake/submit-rageshake");
jest.mock("../../src/stores/WidgetStore");
jest.mock("../../src/stores/widgets/WidgetLayoutStore");

const TEST_SENDER = "@sender@example.com";

describe("AutoRageshakeStore", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let utdEvent: MatrixEvent;
    let autoRageshakeStore: AutoRageshakeStore;

    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        client = stubClient();

        // @ts-ignore bypass private ctor for tests
        autoRageshakeStore = new AutoRageshakeStore();
        autoRageshakeStore.start();

        utdEvent = mkEvent({
            event: true,
            content: {},
            room: roomId,
            user: TEST_SENDER,
            type: EventType.RoomMessage,
        });
        jest.spyOn(utdEvent, "isDecryptionFailure").mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("when the initial sync completed", () => {
        beforeEach(() => {
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Stopped, { nextSyncToken: "abc123" });
        });

        describe("and an undecryptable event occurs", () => {
            beforeEach(() => {
                client.emit(MatrixEventEvent.Decrypted, utdEvent);
                // simulate event grace period
                jest.advanceTimersByTime(5500);
            });

            it("should send a to-device message", () => {
                expect(mocked(client).sendToDevice.mock.calls).toEqual([
                    [
                        "im.vector.auto_rs_request",
                        new Map([
                            [
                                TEST_SENDER,
                                new Map([
                                    [
                                        undefined,
                                        {
                                            "device_id": undefined,
                                            "event_id": utdEvent.getId(),
                                            "org.matrix.msgid": expect.any(String),
                                            "recipient_rageshake": undefined,
                                            "room_id": "!room:example.com",
                                            "sender_key": undefined,
                                            "session_id": undefined,
                                            "user_id": TEST_SENDER,
                                        },
                                    ],
                                ]),
                            ],
                        ]),
                    ],
                ]);
            });
        });
    });
});
