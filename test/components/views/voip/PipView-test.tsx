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
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";

describe("PipView", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let sdkContext: TestSdkContext;
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore;
    let voiceBroadcastPreRecordingStore: VoiceBroadcastPreRecordingStore;

    beforeEach(async () => {
        stubClient();
        client = mocked(MatrixClientPeg.get());
        DMRoomMap.makeShared();

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        room.currentState.setStateEvents([
            mkRoomCreateEvent(alice.userId, room.roomId),
        ]);
        jest.spyOn(room, "getMember").mockImplementation(userId => userId === alice.userId ? alice : null);

        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(
            store => setupAsyncStoreWithClient(store, client),
        ));

        sdkContext = new TestSdkContext();
        voiceBroadcastRecordingsStore = new VoiceBroadcastRecordingsStore();
        voiceBroadcastPreRecordingStore = new VoiceBroadcastPreRecordingStore();
        sdkContext.client = client;
        sdkContext._VoiceBroadcastRecordingsStore = voiceBroadcastRecordingsStore;
        sdkContext._VoiceBroadcastPreRecordingStore = voiceBroadcastPreRecordingStore;
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
        viewRoom("!2:example.org");
        renderPip();

        withWidget(() => {
            screen.getByRole("complementary");
            screen.getByText(room.roomId);
            expect(screen.queryByRole("button", { name: "Pin" })).toBeNull();
            expect(screen.queryByRole("button", { name: "Fill screen" })).toBeNull();
            screen.getByRole("button", { name: /return/i });
        });
    });

    describe("when there is a voice broadcast recording", () => {
        beforeEach(() => {
            const voiceBroadcastInfoEvent = mkVoiceBroadcastInfoStateEvent(
                room.roomId,
                VoiceBroadcastInfoState.Started,
                alice.userId,
                client.getDeviceId() || "",
            );

            const voiceBroadcastRecording = new VoiceBroadcastRecording(voiceBroadcastInfoEvent, client);
            voiceBroadcastRecordingsStore.setCurrent(voiceBroadcastRecording);

            renderPip();
        });

        it("should render the voice broadcast recording PiP", () => {
            // check for the „Live“ badge
            screen.getByText("Live");
        });
    });

    describe("when there is a voice broadcast pre-recording", () => {
        beforeEach(() => {
            const voiceBroadcastPreRecording = new VoiceBroadcastPreRecording(
                room,
                alice,
                client,
                voiceBroadcastRecordingsStore,
            );
            voiceBroadcastPreRecordingStore.setCurrent(voiceBroadcastPreRecording);

            renderPip();
        });

        it("should render the voice broadcast pre-recording PiP", () => {
            // check for the „Go live“ button
            screen.getByText("Go live");
        });
    });
});
