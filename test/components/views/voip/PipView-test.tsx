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
import { mocked, Mocked } from "jest-mock";
import { screen, render, act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget, ClientWidgetApi } from "matrix-widget-api";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import {
    useMockedCalls,
    MockedCall,
    mkRoomMember,
    stubClient,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    wrapInMatrixClientContext,
    wrapInSdkContext,
    mkRoomCreateEvent,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { CallStore } from "../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import UnwrappedPipView from "../../../../src/components/views/voip/PipView";
import ActiveWidgetStore from "../../../../src/stores/ActiveWidgetStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { ViewRoomPayload } from "../../../../src/dispatcher/payloads/ViewRoomPayload";
import { TestSdkContext } from "../../../TestSdkContext";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";
import { RoomViewStore } from "../../../../src/stores/RoomViewStore";
import { IRoomStateEventsActionPayload } from "../../../../src/actions/MatrixActionCreators";

describe("PipView", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let sdkContext: TestSdkContext;
    let client: Mocked<MatrixClient>;
    let room: Room;
    let room2: Room;
    let alice: RoomMember;
    let voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore;
    let voiceBroadcastPreRecordingStore: VoiceBroadcastPreRecordingStore;
    let voiceBroadcastPlaybacksStore: VoiceBroadcastPlaybacksStore;

    beforeEach(async () => {
        stubClient();
        client = mocked(MatrixClientPeg.get());
        DMRoomMap.makeShared();

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");

        room2 = new Room("!2:example.com", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        client.getRoom.mockImplementation((roomId: string) => {
            if (roomId === room.roomId) return room;
            if (roomId === room2.roomId) return room2;
            return null;
        });
        client.getRooms.mockReturnValue([room, room2]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        room.currentState.setStateEvents([
            mkRoomCreateEvent(alice.userId, room.roomId),
        ]);
        jest.spyOn(room, "getMember").mockImplementation(userId => userId === alice.userId ? alice : null);

        room2.currentState.setStateEvents([
            mkRoomCreateEvent(alice.userId, room2.roomId),
        ]);

        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(
            store => setupAsyncStoreWithClient(store, client),
        ));

        sdkContext = new TestSdkContext();
        voiceBroadcastRecordingsStore = new VoiceBroadcastRecordingsStore();
        voiceBroadcastPreRecordingStore = new VoiceBroadcastPreRecordingStore();
        voiceBroadcastPlaybacksStore = new VoiceBroadcastPlaybacksStore();
        sdkContext.client = client;
        sdkContext._VoiceBroadcastRecordingsStore = voiceBroadcastRecordingsStore;
        sdkContext._VoiceBroadcastPreRecordingStore = voiceBroadcastPreRecordingStore;
        sdkContext._VoiceBroadcastPlaybacksStore = voiceBroadcastPlaybacksStore;
    });

    afterEach(async () => {
        cleanup();
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        jest.restoreAllMocks();
    });

    const renderPip = () => {
        const PipView = wrapInMatrixClientContext(
            wrapInSdkContext(UnwrappedPipView, sdkContext),
        );
        render(<PipView />);
    };

    const viewRoom = (roomId: string) =>
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: undefined,
        }, true);

    const withCall = async (fn: () => Promise<void>): Promise<void> => {
        MockedCall.create(room, "1");
        const call = CallStore.instance.getCall(room.roomId);
        if (!(call instanceof MockedCall)) throw new Error("Failed to create call");

        const widget = new Widget(call.widget);
        WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
            stop: () => {},
        } as unknown as ClientWidgetApi);

        await act(async () => {
            await call.connect();
            ActiveWidgetStore.instance.setWidgetPersistence(widget.id, room.roomId, true);
        });

        await fn();

        cleanup();
        call.destroy();
        ActiveWidgetStore.instance.destroyPersistentWidget(widget.id, room.roomId);
    };

    const withWidget = (fn: () => void): void => {
        act(() => ActiveWidgetStore.instance.setWidgetPersistence("1", room.roomId, true));
        fn();
        cleanup();
        ActiveWidgetStore.instance.destroyPersistentWidget("1", room.roomId);
    };

    const makeVoiceBroadcastInfoStateEvent = (): MatrixEvent => {
        return mkVoiceBroadcastInfoStateEvent(
            room.roomId,
            VoiceBroadcastInfoState.Started,
            alice.userId,
            client.getDeviceId() || "",
        );
    };

    const setUpVoiceBroadcastRecording = () => {
        const infoEvent = makeVoiceBroadcastInfoStateEvent();
        const voiceBroadcastRecording = new VoiceBroadcastRecording(infoEvent, client);
        voiceBroadcastRecordingsStore.setCurrent(voiceBroadcastRecording);
    };

    const setUpVoiceBroadcastPreRecording = () => {
        const voiceBroadcastPreRecording = new VoiceBroadcastPreRecording(
            room,
            alice,
            client,
            voiceBroadcastPlaybacksStore,
            voiceBroadcastRecordingsStore,
        );
        voiceBroadcastPreRecordingStore.setCurrent(voiceBroadcastPreRecording);
    };

    const setUpRoomViewStore = () => {
        new RoomViewStore(defaultDispatcher, sdkContext);
    };

    const startVoiceBroadcastPlayback = (room: Room): MatrixEvent => {
        const infoEvent = makeVoiceBroadcastInfoStateEvent();
        room.currentState.setStateEvents([infoEvent]);
        defaultDispatcher.dispatch<IRoomStateEventsActionPayload>({
            action: "MatrixActions.RoomState.events",
            event: infoEvent,
            state: room.currentState,
            lastStateEvent: null,
        }, true);
        return infoEvent;
    };

    it("hides if there's no content", () => {
        renderPip();
        expect(screen.queryByRole("complementary")).toBeNull();
    });

    it("shows an active call with a maximise button", async () => {
        renderPip();

        await withCall(async () => {
            screen.getByRole("complementary");
            screen.getByText(room.roomId);
            expect(screen.queryByRole("button", { name: "Pin" })).toBeNull();
            expect(screen.queryByRole("button", { name: /return/i })).toBeNull();

            // The maximise button should jump to the call
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            fireEvent.click(screen.getByRole("button", { name: "Fill screen" }));
            await waitFor(() => expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
            }));
            defaultDispatcher.unregister(dispatcherRef);
        });
    });

    it("shows a persistent widget with pin and maximise buttons when viewing the room", () => {
        viewRoom(room.roomId);
        renderPip();

        withWidget(() => {
            screen.getByRole("complementary");
            screen.getByText(room.roomId);
            screen.getByRole("button", { name: "Pin" });
            screen.getByRole("button", { name: "Fill screen" });
            expect(screen.queryByRole("button", { name: /return/i })).toBeNull();
        });
    });

    it("shows a persistent widget with a return button when not viewing the room", () => {
        viewRoom(room2.roomId);
        renderPip();

        withWidget(() => {
            screen.getByRole("complementary");
            screen.getByText(room.roomId);
            expect(screen.queryByRole("button", { name: "Pin" })).toBeNull();
            expect(screen.queryByRole("button", { name: "Fill screen" })).toBeNull();
            screen.getByRole("button", { name: /return/i });
        });
    });

    describe("when there is a voice broadcast recording and pre-recording", () => {
        beforeEach(() => {
            setUpVoiceBroadcastPreRecording();
            setUpVoiceBroadcastRecording();
            renderPip();
        });

        it("should render the voice broadcast recording PiP", () => {
            // check for the „Live“ badge
            expect(screen.queryByText("Live")).toBeInTheDocument();
        });
    });

    describe("when there is a voice broadcast playback and pre-recording", () => {
        beforeEach(() => {
            startVoiceBroadcastPlayback(room);
            setUpVoiceBroadcastPreRecording();
            renderPip();
        });

        it("should render the voice broadcast pre-recording PiP", () => {
            // check for the „Go live“ button
            expect(screen.queryByText("Go live")).toBeInTheDocument();
        });
    });

    describe("when there is a voice broadcast pre-recording", () => {
        beforeEach(() => {
            setUpVoiceBroadcastPreRecording();
            renderPip();
        });

        it("should render the voice broadcast pre-recording PiP", () => {
            // check for the „Go live“ button
            expect(screen.queryByText("Go live")).toBeInTheDocument();
        });
    });

    describe("when viewing a room with a live voice broadcast", () => {
        let startEvent: MatrixEvent | null = null;

        beforeEach(() => {
            setUpRoomViewStore();
            viewRoom(room.roomId);
            startEvent = startVoiceBroadcastPlayback(room);
            renderPip();
        });

        it("should render the voice broadcast playback pip", () => {
            // check for the „resume voice broadcast“ button
            expect(screen.queryByLabelText("play voice broadcast")).toBeInTheDocument();
        });

        describe("and the broadcast stops", () => {
            beforeEach(() => {
                act(() => {
                    const stopEvent = mkVoiceBroadcastInfoStateEvent(
                        room.roomId,
                        VoiceBroadcastInfoState.Stopped,
                        alice.userId,
                        client.getDeviceId() || "",
                        startEvent,
                    );
                    room.currentState.setStateEvents([stopEvent]);
                    defaultDispatcher.dispatch<IRoomStateEventsActionPayload>({
                        action: "MatrixActions.RoomState.events",
                        event: stopEvent,
                        state: room.currentState,
                        lastStateEvent: stopEvent,
                    }, true);
                });
            });

            it("should not render the voice broadcast playback pip", () => {
                // check for the „resume voice broadcast“ button
                expect(screen.queryByLabelText("play voice broadcast")).not.toBeInTheDocument();
            });
        });

        describe("and leaving the room", () => {
            beforeEach(() => {
                act(() => {
                    viewRoom(room2.roomId);
                });
            });

            it("should not render the voice broadcast playback pip", () => {
                // check for the „resume voice broadcast“ button
                expect(screen.queryByLabelText("play voice broadcast")).not.toBeInTheDocument();
            });
        });
    });
});
