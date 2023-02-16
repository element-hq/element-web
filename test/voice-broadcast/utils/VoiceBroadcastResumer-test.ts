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
import { ClientEvent, MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";

import {
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastResumer,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("VoiceBroadcastResumer", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let resumer: VoiceBroadcastResumer;
    let startedInfoEvent: MatrixEvent;
    let pausedInfoEvent: MatrixEvent;

    const itShouldNotSendAStateEvent = (): void => {
        it("should not send a state event", () => {
            expect(client.sendStateEvent).not.toHaveBeenCalled();
        });
    };

    const itShouldSendAStoppedStateEvent = (): void => {
        it("should send a stopped state event", () => {
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                startedInfoEvent.getRoomId(),
                VoiceBroadcastInfoEventType,
                {
                    "device_id": client.getDeviceId(),
                    "state": VoiceBroadcastInfoState.Stopped,
                    "m.relates_to": {
                        rel_type: RelationType.Reference,
                        event_id: startedInfoEvent.getId(),
                    },
                } as VoiceBroadcastInfoEventContent,
                client.getUserId()!,
            );
        });
    };

    const itShouldDeregisterFromTheClient = () => {
        it("should deregister from the client", () => {
            expect(client.off).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
        });
    };

    beforeEach(() => {
        client = stubClient();
        jest.spyOn(client, "off");
        room = new Room(roomId, client, client.getUserId()!);
        mocked(client.getRoom).mockImplementation((getRoomId: string | undefined) => {
            if (getRoomId === roomId) return room;

            return null;
        });
        mocked(client.getRooms).mockReturnValue([room]);
        startedInfoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.getDeviceId()!,
        );
        pausedInfoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Paused,
            client.getUserId()!,
            client.getDeviceId()!,
            startedInfoEvent,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("when the initial sync is completed", () => {
        beforeEach(() => {
            mocked(client.isInitialSyncComplete).mockReturnValue(true);
        });

        describe("and there is no info event", () => {
            beforeEach(() => {
                resumer = new VoiceBroadcastResumer(client);
            });

            itShouldNotSendAStateEvent();

            describe("and calling destroy", () => {
                beforeEach(() => {
                    resumer.destroy();
                });

                itShouldDeregisterFromTheClient();
            });
        });

        describe("and there is a started info event", () => {
            beforeEach(() => {
                room.currentState.setStateEvents([startedInfoEvent]);
            });

            describe("and the client knows about the user and device", () => {
                beforeEach(() => {
                    resumer = new VoiceBroadcastResumer(client);
                });

                itShouldSendAStoppedStateEvent();
            });

            describe("and the client doesn't know about the user", () => {
                beforeEach(() => {
                    mocked(client.getUserId).mockReturnValue(null);
                    resumer = new VoiceBroadcastResumer(client);
                });

                itShouldNotSendAStateEvent();
            });

            describe("and the client doesn't know about the device", () => {
                beforeEach(() => {
                    mocked(client.getDeviceId).mockReturnValue(null);
                    resumer = new VoiceBroadcastResumer(client);
                });

                itShouldNotSendAStateEvent();
            });
        });

        describe("and there is a paused info event", () => {
            beforeEach(() => {
                room.currentState.setStateEvents([pausedInfoEvent]);
                resumer = new VoiceBroadcastResumer(client);
            });

            itShouldSendAStoppedStateEvent();
        });
    });

    describe("when the initial sync is not completed", () => {
        beforeEach(() => {
            room.currentState.setStateEvents([pausedInfoEvent]);
            mocked(client.isInitialSyncComplete).mockReturnValue(false);
            mocked(client.getSyncState).mockReturnValue(SyncState.Prepared);
            resumer = new VoiceBroadcastResumer(client);
        });

        itShouldNotSendAStateEvent();

        describe("and a sync event appears", () => {
            beforeEach(() => {
                client.emit(ClientEvent.Sync, SyncState.Prepared, SyncState.Stopped);
            });

            itShouldNotSendAStateEvent();

            describe("and the initial sync completed and a sync event appears", () => {
                beforeEach(() => {
                    mocked(client.getSyncState).mockReturnValue(SyncState.Syncing);
                    client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Prepared);
                });

                itShouldSendAStoppedStateEvent();
                itShouldDeregisterFromTheClient();
            });
        });
    });
});
