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

import React from "react";
import userEvent from "@testing-library/user-event";
import { CallType, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { EventType, MatrixEvent, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { getAllByTitle, getByLabelText, getByText, getByTitle, render, screen } from "@testing-library/react";

import { mkEvent, stubClient, withClientContextRenderOptions } from "../../../test-utils";
import RoomHeader from "../../../../src/components/views/rooms/RoomHeader";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import LegacyCallHandler from "../../../../src/LegacyCallHandler";
import SettingsStore from "../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../src/SdkConfig";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import { CallStore } from "../../../../src/stores/CallStore";
import { Call, ElementCall } from "../../../../src/models/Call";

describe("RoomHeader", () => {
    let room: Room;

    const ROOM_ID = "!1:example.org";

    let setCardSpy: jest.SpyInstance | undefined;

    beforeEach(async () => {
        stubClient();
        room = new Room(ROOM_ID, MatrixClientPeg.get()!, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        setCardSpy = jest.spyOn(RightPanelStore.instance, "setCard");
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("renders the room header", () => {
        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );
        expect(container).toHaveTextContent(ROOM_ID);
    });

    it("renders the room topic", async () => {
        const TOPIC = "Hello World!";

        const roomTopic = new MatrixEvent({
            type: EventType.RoomTopic,
            event_id: "$00002",
            room_id: room.roomId,
            sender: "@alice:example.com",
            origin_server_ts: 1,
            content: { topic: TOPIC },
            state_key: "",
        });
        await room.addLiveEvents([roomTopic]);

        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );
        expect(container).toHaveTextContent(TOPIC);
    });

    it("opens the room summary", async () => {
        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        await userEvent.click(getByText(container, ROOM_ID));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomSummary });
    });

    it("does not show the face pile for DMs", () => {
        const client = MatrixClientPeg.get()!;

        jest.spyOn(client, "getAccountData").mockReturnValue(
            mkEvent({
                event: true,
                type: EventType.Direct,
                user: client.getSafeUserId(),
                content: {
                    "user@example.com": [room.roomId],
                },
            }),
        );

        room.getJoinedMembers = jest.fn().mockReturnValue([
            {
                userId: "@me:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: "join",
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
        ]);

        const { asFragment } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        expect(asFragment()).toMatchSnapshot();
    });

    it("shows a face pile for rooms", async () => {
        const members = [
            {
                userId: "@me:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: "join",
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@you:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: "join",
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@them:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: "join",
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@bot:example.org",
                name: "Bot user",
                rawDisplayName: "Bot user",
                roomId: room.roomId,
                membership: "join",
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
        ];
        room.currentState.setJoinedMemberCount(members.length);
        room.getJoinedMembers = jest.fn().mockReturnValue(members);

        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        expect(container).toHaveTextContent("4");

        const facePile = getByLabelText(container, "4 members");
        expect(facePile).toHaveTextContent("4");

        await userEvent.click(facePile);

        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomMemberList });
    });

    it("opens the thread panel", async () => {
        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        await userEvent.click(getByTitle(container, "Threads"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel });
    });

    it("opens the notifications panel", async () => {
        const { container } = render(
            <RoomHeader room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        await userEvent.click(getByTitle(container, "Notifications"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.NotificationPanel });
    });

    describe("groups call disabled", () => {
        it("you can't call if you're alone", () => {
            mockRoomMembers(room, 1);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            for (const button of getAllByTitle(container, "There's no one here to call")) {
                expect(button).toBeDisabled();
            }
        });

        it("you can call when you're two in the room", async () => {
            mockRoomMembers(room, 2);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            const voiceButton = getByTitle(container, "Voice call");
            const videoButton = getByTitle(container, "Video call");
            expect(voiceButton).not.toBeDisabled();
            expect(videoButton).not.toBeDisabled();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");

            await userEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            await userEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("you can't call if there's already a call", () => {
            mockRoomMembers(room, 2);
            jest.spyOn(LegacyCallHandler.instance, "getCallForRoom").mockReturnValue(
                // The JS-SDK does not export the class `MatrixCall` only the type
                {} as MatrixCall,
            );
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            for (const button of getAllByTitle(container, "Ongoing call")) {
                expect(button).toBeDisabled();
            }
        });

        it("can calls in large rooms if able to edit widgets", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );

            expect(getByTitle(container, "Voice call")).not.toBeDisabled();
            expect(getByTitle(container, "Video call")).not.toBeDisabled();
        });

        it("disable calls in large rooms by default", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(false);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            expect(getByTitle(container, "You do not have permission to start voice calls")).toBeDisabled();
            expect(getByTitle(container, "You do not have permission to start video calls")).toBeDisabled();
        });
    });

    describe("group call enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_group_calls");
        });

        it("renders only the video call element", async () => {
            jest.spyOn(SdkConfig, "get").mockReturnValue({ use_exclusively: true });
            // allow element calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);

            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );

            expect(screen.queryByTitle("Voice call")).toBeNull();

            const videoCallButton = getByTitle(container, "Video call");
            expect(videoCallButton).not.toBeDisabled();

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch");

            await userEvent.click(getByTitle(container, "Video call"));

            expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ view_call: true }));
        });

        it("can call if there's an ongoing call", () => {
            jest.spyOn(SdkConfig, "get").mockReturnValue({ use_exclusively: true });
            // allow element calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);

            jest.spyOn(CallStore.instance, "getCall").mockReturnValue({} as Call);

            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            expect(getByTitle(container, "Ongoing call")).toBeDisabled();
        });

        it("disables calling if there's a jitsi call", () => {
            mockRoomMembers(room, 2);
            jest.spyOn(LegacyCallHandler.instance, "getCallForRoom").mockReturnValue(
                // The JS-SDK does not export the class `MatrixCall` only the type
                {} as MatrixCall,
            );
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            for (const button of getAllByTitle(container, "Ongoing call")) {
                expect(button).toBeDisabled();
            }
        });

        it("can't call if you have no friends", () => {
            mockRoomMembers(room, 1);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );
            for (const button of getAllByTitle(container, "There's no one here to call")) {
                expect(button).toBeDisabled();
            }
        });

        it("calls using legacy or jitsi", async () => {
            mockRoomMembers(room, 2);
            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );

            const voiceButton = getByTitle(container, "Voice call");
            const videoButton = getByTitle(container, "Video call");
            expect(voiceButton).not.toBeDisabled();
            expect(videoButton).not.toBeDisabled();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            await userEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            await userEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using legacy or jitsi for large rooms", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                return false;
            });

            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );

            const voiceButton = getByTitle(container, "Voice call");
            const videoButton = getByTitle(container, "Video call");
            expect(voiceButton).not.toBeDisabled();
            expect(videoButton).not.toBeDisabled();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            await userEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            await userEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using element calls for large rooms", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                if (key === ElementCall.CALL_EVENT_TYPE.name) return true;
                return false;
            });

            const { container } = render(
                <RoomHeader room={room} />,
                withClientContextRenderOptions(MatrixClientPeg.get()!),
            );

            const voiceButton = getByTitle(container, "Voice call");
            const videoButton = getByTitle(container, "Video call");
            expect(voiceButton).not.toBeDisabled();
            expect(videoButton).not.toBeDisabled();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            await userEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch");
            await userEvent.click(videoButton);
            expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ view_call: true }));
        });
    });
});

/**
 *
 * @param count the number of users to create
 */
function mockRoomMembers(room: Room, count: number) {
    const members = Array(count)
        .fill(0)
        .map((_, index) => ({
            userId: `@user-${index}:example.org`,
            name: `Member ${index}`,
            rawDisplayName: `Member ${index}`,
            roomId: room.roomId,
            membership: "join",
            getAvatarUrl: () => `mxc://avatar.url/user-${index}.png`,
            getMxcAvatarUrl: () => `mxc://avatar.url/user-${index}.png`,
        }));

    room.currentState.setJoinedMemberCount(members.length);
    room.getJoinedMembers = jest.fn().mockReturnValue(members);
}
