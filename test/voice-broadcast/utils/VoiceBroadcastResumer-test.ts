/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { ClientEvent, MatrixClient, MatrixEvent, RelationType, Room, SyncState } from "matrix-js-sdk/src/matrix";

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
