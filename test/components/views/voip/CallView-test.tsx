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
import { zip } from "lodash";
import { render, screen, act, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    wrapInMatrixClientContext,
    useMockedCalls,
    MockedCall,
    setupAsyncStoreWithClient,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { CallView as _CallView } from "../../../../src/components/views/voip/CallView";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { CallStore } from "../../../../src/stores/CallStore";
import { Call, ConnectionState } from "../../../../src/models/Call";
import SdkConfig from "../../../../src/SdkConfig";

const CallView = wrapInMatrixClientContext(_CallView);

describe("CallLobby", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;

    beforeEach(() => {
        mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([]);

        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        jest.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        setupAsyncStoreWithClient(CallStore.instance, client);
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);
    });

    afterEach(() => {
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
    });

    const renderView = async (): Promise<void> => {
        render(<CallView room={room} resizing={false} waitForCall={false} />);
        await act(() => Promise.resolve()); // Let effects settle
    };

    describe("with an existing call", () => {
        let call: MockedCall;
        let widget: Widget;

        beforeEach(() => {
            MockedCall.create(room, "1");
            const maybeCall = CallStore.instance.getCall(room.roomId);
            if (!(maybeCall instanceof MockedCall)) throw new Error("Failed to create call");
            call = maybeCall;

            widget = new Widget(call.widget);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);
        });

        afterEach(() => {
            cleanup(); // Unmount before we do any cleanup that might update the component
            call.destroy();
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });

        it("calls clean on mount", async () => {
            const cleanSpy = jest.spyOn(call, "clean");
            await renderView();
            expect(cleanSpy).toHaveBeenCalled();
        });

        it("shows lobby and keeps widget loaded when disconnected", async () => {
            await renderView();
            screen.getByRole("button", { name: "Join" });
            screen.getAllByText(/\bwidget\b/i);
        });

        it("only shows widget when connected", async () => {
            await renderView();
            fireEvent.click(screen.getByRole("button", { name: "Join" }));
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connected));
            expect(screen.queryByRole("button", { name: "Join" })).toBe(null);
            screen.getAllByText(/\bwidget\b/i);
        });

        it("tracks participants", async () => {
            const bob = mkRoomMember(room.roomId, "@bob:example.org");
            const carol = mkRoomMember(room.roomId, "@carol:example.org");

            const expectAvatars = (userIds: string[]) => {
                const avatars = screen.queryAllByRole("button", { name: "Avatar" });
                expect(userIds.length).toBe(avatars.length);

                for (const [userId, avatar] of zip(userIds, avatars)) {
                    fireEvent.focus(avatar!);
                    screen.getAllByRole("tooltip", { name: userId });
                }
            };

            await renderView();
            expect(screen.queryByLabelText(/joined/)).toBe(null);
            expectAvatars([]);

            act(() => {
                call.participants = new Map([[alice, new Set(["a"])]]);
            });
            screen.getByText("1 person joined");
            expectAvatars([alice.userId]);

            act(() => {
                call.participants = new Map([
                    [alice, new Set(["a"])],
                    [bob, new Set(["b1", "b2"])],
                    [carol, new Set(["c"])],
                ]);
            });
            screen.getByText("4 people joined");
            expectAvatars([alice.userId, bob.userId, bob.userId, carol.userId]);

            act(() => {
                call.participants = new Map();
            });
            expect(screen.queryByLabelText(/joined/)).toBe(null);
            expectAvatars([]);
        });

        it("connects to the call when the join button is pressed", async () => {
            await renderView();
            const connectSpy = jest.spyOn(call, "connect");
            fireEvent.click(screen.getByRole("button", { name: "Join" }));
            await waitFor(() => expect(connectSpy).toHaveBeenCalled(), { interval: 1 });
        });

        it("disables join button when the participant limit has been exceeded", async () => {
            const bob = mkRoomMember(room.roomId, "@bob:example.org");
            const carol = mkRoomMember(room.roomId, "@carol:example.org");

            SdkConfig.put({
                element_call: { participant_limit: 2, url: "", use_exclusively: false, brand: "Element Call" },
            });
            call.participants = new Map([
                [bob, new Set("b")],
                [carol, new Set("c")],
            ]);

            await renderView();
            const connectSpy = jest.spyOn(call, "connect");
            const joinButton = screen.getByRole("button", { name: "Join" });
            expect(joinButton).toHaveAttribute("aria-disabled", "true");
            fireEvent.click(joinButton);
            await waitFor(() => expect(connectSpy).not.toHaveBeenCalled(), { interval: 1 });
        });
    });

    describe("without an existing call", () => {
        it("creates and connects to a new call when the join button is pressed", async () => {
            await renderView();
            expect(Call.get(room)).toBeNull();

            fireEvent.click(screen.getByRole("button", { name: "Join" }));
            await waitFor(() => expect(CallStore.instance.getCall(room.roomId)).not.toBeNull());
            const call = CallStore.instance.getCall(room.roomId)!;

            const widget = new Widget(call.widget);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connected));

            cleanup(); // Unmount before we do any cleanup that might update the component
            call.destroy();
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });
    });

    describe("device buttons", () => {
        const fakeVideoInput1: MediaDeviceInfo = {
            deviceId: "v1",
            groupId: "v1",
            label: "Webcam",
            kind: "videoinput",
            toJSON: () => {},
        };
        const fakeVideoInput2: MediaDeviceInfo = {
            deviceId: "v2",
            groupId: "v2",
            label: "Othercam",
            kind: "videoinput",
            toJSON: () => {},
        };
        const fakeAudioInput1: MediaDeviceInfo = {
            deviceId: "v1",
            groupId: "v1",
            label: "Headphones",
            kind: "audioinput",
            toJSON: () => {},
        };
        const fakeAudioInput2: MediaDeviceInfo = {
            deviceId: "v2",
            groupId: "v2",
            label: "Tailphones",
            kind: "audioinput",
            toJSON: () => {},
        };

        it("hide when no devices are available", async () => {
            await renderView();
            expect(screen.queryByRole("button", { name: /microphone/ })).toBe(null);
            expect(screen.queryByRole("button", { name: /camera/ })).toBe(null);
        });

        it("show without dropdown when only one device is available", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([fakeVideoInput1]);

            await renderView();
            screen.getByRole("button", { name: /camera/ });
            expect(screen.queryByRole("button", { name: "Video devices" })).toBe(null);
        });

        it("show with dropdown when multiple devices are available", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([fakeAudioInput1, fakeAudioInput2]);

            await renderView();
            screen.getByRole("button", { name: /microphone/ });
            fireEvent.click(screen.getByRole("button", { name: "Audio devices" }));
            screen.getByRole("menuitem", { name: "Headphones" });
            screen.getByRole("menuitem", { name: "Tailphones" });
        });

        it("sets video device when selected", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([fakeVideoInput1, fakeVideoInput2]);

            await renderView();
            screen.getByRole("button", { name: /camera/ });
            fireEvent.click(screen.getByRole("button", { name: "Video devices" }));
            fireEvent.click(screen.getByRole("menuitem", { name: fakeVideoInput2.label }));

            expect(client.getMediaHandler().setVideoInput).toHaveBeenCalledWith(fakeVideoInput2.deviceId);
        });

        it("sets audio device when selected", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([fakeAudioInput1, fakeAudioInput2]);

            await renderView();
            screen.getByRole("button", { name: /microphone/ });
            fireEvent.click(screen.getByRole("button", { name: "Audio devices" }));
            fireEvent.click(screen.getByRole("menuitem", { name: fakeAudioInput2.label }));

            expect(client.getMediaHandler().setAudioInput).toHaveBeenCalledWith(fakeAudioInput2.deviceId);
        });
    });
});
