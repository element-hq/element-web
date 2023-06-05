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
import { screen, render, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget, ClientWidgetApi } from "matrix-widget-api";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { UserEvent } from "@testing-library/user-event/dist/types/setup/setup";

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
    mockPlatformPeg,
    flushPromises,
} from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { CallStore } from "../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import { PipContainer as UnwrappedPipContainer } from "../../../src/components/structures/PipContainer";
import ActiveWidgetStore from "../../../src/stores/ActiveWidgetStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import { TestSdkContext } from "../../TestSdkContext";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../voice-broadcast/utils/test-utils";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import { IRoomStateEventsActionPayload } from "../../../src/actions/MatrixActionCreators";
import { Container, WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import WidgetStore from "../../../src/stores/WidgetStore";
import { WidgetType } from "../../../src/widgets/WidgetType";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";

describe("PipContainer", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let user: UserEvent;
    let sdkContext: TestSdkContext;
    let client: Mocked<MatrixClient>;
    let room: Room;
    let room2: Room;
    let alice: RoomMember;
    let voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore;
    let voiceBroadcastPreRecordingStore: VoiceBroadcastPreRecordingStore;
    let voiceBroadcastPlaybacksStore: VoiceBroadcastPlaybacksStore;

    const actFlushPromises = async () => {
        await act(async () => {
            await flushPromises();
        });
    };

    beforeEach(async () => {
        user = userEvent.setup();

        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(client);

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

        room.currentState.setStateEvents([mkRoomCreateEvent(alice.userId, room.roomId)]);
        jest.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        room2.currentState.setStateEvents([mkRoomCreateEvent(alice.userId, room2.roomId)]);

        await Promise.all(
            [CallStore.instance, WidgetMessagingStore.instance].map((store) =>
                setupAsyncStoreWithClient(store, client),
            ),
        );

        sdkContext = new TestSdkContext();
        // @ts-ignore PipContainer uses SDKContext in the constructor
        SdkContextClass.instance = sdkContext;
        voiceBroadcastRecordingsStore = new VoiceBroadcastRecordingsStore();
        voiceBroadcastPreRecordingStore = new VoiceBroadcastPreRecordingStore();
        voiceBroadcastPlaybacksStore = new VoiceBroadcastPlaybacksStore(voiceBroadcastRecordingsStore);
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
        const PipContainer = wrapInMatrixClientContext(wrapInSdkContext(UnwrappedPipContainer, sdkContext));
        render(<PipContainer />);
    };

    const viewRoom = (roomId: string) => {
        defaultDispatcher.dispatch<ViewRoomPayload>(
            {
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: undefined,
            },
            true,
        );
    };

    const withCall = async (fn: (call: MockedCall) => Promise<void>): Promise<void> => {
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

        await fn(call);

        cleanup();
        call.destroy();
        ActiveWidgetStore.instance.destroyPersistentWidget(widget.id, room.roomId);
    };

    const withWidget = async (fn: () => Promise<void>): Promise<void> => {
        act(() => ActiveWidgetStore.instance.setWidgetPersistence("1", room.roomId, true));
        await fn();
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
        sdkContext._RoomViewStore = new RoomViewStore(defaultDispatcher, sdkContext);
    };

    const mkVoiceBroadcast = (room: Room): MatrixEvent => {
        const infoEvent = makeVoiceBroadcastInfoStateEvent();
        room.currentState.setStateEvents([infoEvent]);
        defaultDispatcher.dispatch<IRoomStateEventsActionPayload>(
            {
                action: "MatrixActions.RoomState.events",
                event: infoEvent,
                state: room.currentState,
                lastStateEvent: null,
            },
            true,
        );
        return infoEvent;
    };

    it("hides if there's no content", () => {
        renderPip();
        expect(screen.queryByRole("complementary")).toBeNull();
    });

    it("shows an active call with back and leave buttons", async () => {
        renderPip();

        await withCall(async (call) => {
            screen.getByRole("complementary");

            // The return button should jump to the call
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            await user.click(screen.getByRole("button", { name: "Back" }));
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
                metricsTrigger: expect.any(String),
            });
            defaultDispatcher.unregister(dispatcherRef);

            // The leave button should disconnect from the call
            const disconnectSpy = jest.spyOn(call, "disconnect");
            await user.click(screen.getByRole("button", { name: "Leave" }));
            expect(disconnectSpy).toHaveBeenCalled();
        });
    });

    it("shows a persistent widget with back button when viewing the room", async () => {
        setUpRoomViewStore();
        viewRoom(room.roomId);
        const widget = WidgetStore.instance.addVirtualWidget(
            {
                id: "1",
                creatorUserId: "@alice:exaxmple.org",
                type: WidgetType.CUSTOM.preferred,
                url: "https://example.org",
                name: "Example widget",
            },
            room.roomId,
        );
        renderPip();

        await withWidget(async () => {
            screen.getByRole("complementary");

            // The return button should maximize the widget
            const moveSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");
            await user.click(screen.getByRole("button", { name: "Back" }));
            expect(moveSpy).toHaveBeenCalledWith(room, widget, Container.Center);

            expect(screen.queryByRole("button", { name: "Leave" })).toBeNull();
        });

        WidgetStore.instance.removeVirtualWidget("1", room.roomId);
    });

    it("shows a persistent Jitsi widget with back and leave buttons when not viewing the room", async () => {
        mockPlatformPeg({ supportsJitsiScreensharing: () => true });
        setUpRoomViewStore();
        viewRoom(room2.roomId);
        const widget = WidgetStore.instance.addVirtualWidget(
            {
                id: "1",
                creatorUserId: "@alice:exaxmple.org",
                type: WidgetType.JITSI.preferred,
                url: "https://meet.example.org",
                name: "Jitsi example",
            },
            room.roomId,
        );
        renderPip();

        await withWidget(async () => {
            screen.getByRole("complementary");

            // The return button should view the room
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            await user.click(screen.getByRole("button", { name: "Back" }));
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: expect.any(String),
            });
            defaultDispatcher.unregister(dispatcherRef);

            // The leave button should hangup the call
            const sendSpy = jest
                .fn<
                    ReturnType<ClientWidgetApi["transport"]["send"]>,
                    Parameters<ClientWidgetApi["transport"]["send"]>
                >()
                .mockResolvedValue({});
            const mockMessaging = { transport: { send: sendSpy }, stop: () => {} } as unknown as ClientWidgetApi;
            WidgetMessagingStore.instance.storeMessaging(new Widget(widget), room.roomId, mockMessaging);
            await user.click(screen.getByRole("button", { name: "Leave" }));
            expect(sendSpy).toHaveBeenCalledWith(ElementWidgetActions.HangupCall, {});
        });

        WidgetStore.instance.removeVirtualWidget("1", room.roomId);
    });

    describe("when there is a voice broadcast recording and pre-recording", () => {
        beforeEach(async () => {
            setUpVoiceBroadcastPreRecording();
            setUpVoiceBroadcastRecording();
            renderPip();
            await actFlushPromises();
        });

        it("should render the voice broadcast recording PiP", () => {
            // check for the „Live“ badge to be present
            expect(screen.queryByText("Live")).toBeInTheDocument();
        });

        it("and a call it should show both, the call and the recording", async () => {
            await withCall(async () => {
                // Broadcast: Check for the „Live“ badge to be present
                expect(screen.queryByText("Live")).toBeInTheDocument();
                // Call: Check for the „Leave“ button to be present
                screen.getByRole("button", { name: "Leave" });
            });
        });
    });

    describe("when there is a voice broadcast playback and pre-recording", () => {
        beforeEach(async () => {
            mkVoiceBroadcast(room);
            setUpVoiceBroadcastPreRecording();
            renderPip();
            await actFlushPromises();
        });

        it("should render the voice broadcast pre-recording PiP", () => {
            // check for the „Go live“ button
            expect(screen.queryByText("Go live")).toBeInTheDocument();
        });
    });

    describe("when there is a voice broadcast pre-recording", () => {
        beforeEach(async () => {
            setUpVoiceBroadcastPreRecording();
            renderPip();
            await actFlushPromises();
        });

        it("should render the voice broadcast pre-recording PiP", () => {
            // check for the „Go live“ button
            expect(screen.queryByText("Go live")).toBeInTheDocument();
        });
    });

    describe("when listening to a voice broadcast in a room and then switching to another room", () => {
        beforeEach(async () => {
            setUpRoomViewStore();
            viewRoom(room.roomId);
            mkVoiceBroadcast(room);
            await actFlushPromises();

            expect(voiceBroadcastPlaybacksStore.getCurrent()).toBeTruthy();

            await voiceBroadcastPlaybacksStore.getCurrent()?.start();
            viewRoom(room2.roomId);
            renderPip();
        });

        it("should render the small voice broadcast playback PiP", () => {
            // check for the „pause voice broadcast“ button
            expect(screen.getByLabelText("pause voice broadcast")).toBeInTheDocument();
            // check for the absence of the „30s forward“ button
            expect(screen.queryByLabelText("30s forward")).not.toBeInTheDocument();
        });
    });

    describe("when viewing a room with a live voice broadcast", () => {
        let startEvent!: MatrixEvent;

        beforeEach(async () => {
            setUpRoomViewStore();
            viewRoom(room.roomId);
            startEvent = mkVoiceBroadcast(room);
            renderPip();
            await actFlushPromises();
        });

        it("should render the voice broadcast playback pip", () => {
            // check for the „resume voice broadcast“ button
            expect(screen.queryByLabelText("play voice broadcast")).toBeInTheDocument();
        });

        describe("and the broadcast stops", () => {
            beforeEach(async () => {
                const stopEvent = mkVoiceBroadcastInfoStateEvent(
                    room.roomId,
                    VoiceBroadcastInfoState.Stopped,
                    alice.userId,
                    client.getDeviceId() || "",
                    startEvent,
                );

                await act(async () => {
                    room.currentState.setStateEvents([stopEvent]);
                    defaultDispatcher.dispatch<IRoomStateEventsActionPayload>(
                        {
                            action: "MatrixActions.RoomState.events",
                            event: stopEvent,
                            state: room.currentState,
                            lastStateEvent: stopEvent,
                        },
                        true,
                    );
                    await flushPromises();
                });
            });

            it("should not render the voice broadcast playback pip", () => {
                // check for the „resume voice broadcast“ button
                expect(screen.queryByLabelText("play voice broadcast")).not.toBeInTheDocument();
            });
        });

        describe("and leaving the room", () => {
            beforeEach(async () => {
                await act(async () => {
                    viewRoom(room2.roomId);
                    await flushPromises();
                });
            });

            it("should not render the voice broadcast playback pip", () => {
                // check for the „resume voice broadcast“ button
                expect(screen.queryByLabelText("play voice broadcast")).not.toBeInTheDocument();
            });
        });
    });
});
