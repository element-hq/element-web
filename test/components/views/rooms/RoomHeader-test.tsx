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
import { CallType, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import {
    EventType,
    JoinRule,
    MatrixClient,
    MatrixEvent,
    PendingEventOrdering,
    Room,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import {
    createEvent,
    fireEvent,
    getAllByLabelText,
    getByLabelText,
    getByRole,
    getByText,
    queryAllByLabelText,
    render,
    RenderOptions,
    screen,
    waitFor,
} from "@testing-library/react";
import { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import { filterConsole, mkEvent, stubClient } from "../../../test-utils";
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
import * as ShieldUtils from "../../../../src/utils/ShieldUtils";
import { Container, WidgetLayoutStore } from "../../../../src/stores/widgets/WidgetLayoutStore";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { _t } from "../../../../src/languageHandler";
import * as UseCall from "../../../../src/hooks/useCall";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import WidgetStore, { IApp } from "../../../../src/stores/WidgetStore";

jest.mock("../../../../src/utils/ShieldUtils");

function getWrapper(): RenderOptions {
    return {
        wrapper: ({ children }) => (
            <MatrixClientContext.Provider value={MatrixClientPeg.safeGet()}>{children}</MatrixClientContext.Provider>
        ),
    };
}

describe("RoomHeader", () => {
    filterConsole(
        "[getType] Room !1:example.org does not have an m.room.create event",
        "Age for event was not available, using `now - origin_server_ts` as a fallback. If the device clock is not correct issues might occur.",
    );

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
        jest.restoreAllMocks();
    });

    it("renders the room header", () => {
        const { container } = render(<RoomHeader room={room} />, getWrapper());
        expect(container).toHaveTextContent(ROOM_ID);
    });

    it("renders the room topic", async () => {
        const TOPIC = "Hello World! http://element.io";

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

        const { container } = render(<RoomHeader room={room} />, getWrapper());
        expect(container).toHaveTextContent(TOPIC);
        expect(getByRole(container, "link")).toHaveTextContent("http://element.io");
    });

    it("opens the room summary", async () => {
        const { container } = render(<RoomHeader room={room} />, getWrapper());

        fireEvent.click(getByText(container, ROOM_ID));
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
                membership: KnownMembership.Join,
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
        ]);

        const { asFragment } = render(<RoomHeader room={room} />, getWrapper());

        expect(asFragment()).toMatchSnapshot();
    });

    it("shows a face pile for rooms", async () => {
        const members = [
            {
                userId: "@me:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: KnownMembership.Join,
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@you:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: KnownMembership.Join,
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@them:example.org",
                name: "Member",
                rawDisplayName: "Member",
                roomId: room.roomId,
                membership: KnownMembership.Join,
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
            {
                userId: "@bot:example.org",
                name: "Bot user",
                rawDisplayName: "Bot user",
                roomId: room.roomId,
                membership: KnownMembership.Join,
                getAvatarUrl: () => "mxc://avatar.url/image.png",
                getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            },
        ];
        room.currentState.setJoinedMemberCount(members.length);
        room.getJoinedMembers = jest.fn().mockReturnValue(members);

        const { container } = render(<RoomHeader room={room} />, getWrapper());

        expect(container).toHaveTextContent("4");

        const facePile = getByLabelText(container, "4 members");
        expect(facePile).toHaveTextContent("4");

        fireEvent.click(facePile);

        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomMemberList });
    });

    it("opens the thread panel", async () => {
        const { container } = render(<RoomHeader room={room} />, getWrapper());

        fireEvent.click(getByLabelText(container, "Threads"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel });
    });

    it("opens the notifications panel", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            if (name === "feature_notifications") return true;
        });

        const { container } = render(<RoomHeader room={room} />, getWrapper());

        fireEvent.click(getByLabelText(container, "Notifications"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.NotificationPanel });
    });

    describe("groups call disabled", () => {
        it("you can't call if you're alone", () => {
            mockRoomMembers(room, 1);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            for (const button of getAllByLabelText(container, "There's no one here to call")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
        });

        it("you can call when you're two in the room", async () => {
            mockRoomMembers(room, 2);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            const voiceButton = getByLabelText(container, "Voice call");
            const videoButton = getByLabelText(container, "Video call");
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");

            fireEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            fireEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("you can't call if there's already a call", () => {
            mockRoomMembers(room, 2);
            jest.spyOn(LegacyCallHandler.instance, "getCallForRoom").mockReturnValue(
                // The JS-SDK does not export the class `MatrixCall` only the type
                {} as MatrixCall,
            );
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            for (const button of getAllByLabelText(container, "Ongoing call")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
        });

        it("can calls in large rooms if able to edit widgets", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            const { container } = render(<RoomHeader room={room} />, getWrapper());

            expect(getByLabelText(container, "Voice call")).not.toHaveAttribute("aria-disabled", "true");
            expect(getByLabelText(container, "Video call")).not.toHaveAttribute("aria-disabled", "true");
        });

        it("disable calls in large rooms by default", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(false);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            expect(
                getByLabelText(container, "You do not have permission to start voice calls", { selector: "button" }),
            ).toHaveAttribute("aria-disabled", "true");
            expect(
                getByLabelText(container, "You do not have permission to start video calls", { selector: "button" }),
            ).toHaveAttribute("aria-disabled", "true");
        });
    });

    describe("group call enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_group_calls");
        });

        it("renders only the video call element", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(SdkConfig, "get").mockReturnValue({ use_exclusively: true });
            // allow element calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);

            const { container } = render(<RoomHeader room={room} />, getWrapper());

            expect(screen.queryByTitle("Voice call")).toBeNull();

            const videoCallButton = getByLabelText(container, "Video call");
            expect(videoCallButton).not.toHaveAttribute("aria-disabled", "true");

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch");

            fireEvent.click(getByLabelText(container, "Video call"));

            expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ view_call: true }));
        });

        it("can't call if there's an ongoing (pinned) call", () => {
            jest.spyOn(SdkConfig, "get").mockReturnValue({ use_exclusively: true });
            // allow element calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(true);
            const widget = { type: "m.jitsi" } as IApp;
            jest.spyOn(CallStore.instance, "getCall").mockReturnValue({
                widget,
                on: () => {},
            } as unknown as Call);
            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            expect(getByLabelText(container, "Ongoing call")).toHaveAttribute("aria-disabled", "true");
        });

        it("clicking on ongoing (unpinned) call re-pins it", () => {
            mockRoomMembers(room, 3);
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            // allow calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(false);
            const spy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");

            const widget = { type: "m.jitsi" } as IApp;
            jest.spyOn(CallStore.instance, "getCall").mockReturnValue({
                widget,
                on: () => {},
            } as unknown as Call);
            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);

            const { container } = render(<RoomHeader room={room} />, getWrapper());
            expect(getByLabelText(container, "Video call")).not.toHaveAttribute("aria-disabled", "true");
            fireEvent.click(getByLabelText(container, "Video call"));
            expect(spy).toHaveBeenCalledWith(room, widget, Container.Top);
        });

        it("disables calling if there's a jitsi call", () => {
            mockRoomMembers(room, 2);
            jest.spyOn(LegacyCallHandler.instance, "getCallForRoom").mockReturnValue(
                // The JS-SDK does not export the class `MatrixCall` only the type
                {} as MatrixCall,
            );
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            for (const button of getAllByLabelText(container, "Ongoing call")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
        });

        it("can't call if you have no friends and cannot invite friends", () => {
            mockRoomMembers(room, 1);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            for (const button of getAllByLabelText(container, "There's no one here to call")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
        });

        it("can call if you have no friends but can invite friends", () => {
            mockRoomMembers(room, 1);
            // go through all the different `canInvite` and `getJoinRule` combinations

            // check where we can't do anything but can upgrade
            jest.spyOn(room.currentState, "maySendStateEvent").mockReturnValue(true);
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            const guestSpaUrlMock = jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            });
            const { container: containerNoInviteNotPublicCanUpgradeAccess } = render(
                <RoomHeader room={room} />,
                getWrapper(),
            );
            expect(
                queryAllByLabelText(containerNoInviteNotPublicCanUpgradeAccess, "There's no one here to call"),
            ).toHaveLength(0);

            // dont allow upgrading anymore and go through the other combinations
            jest.spyOn(room.currentState, "maySendStateEvent").mockReturnValue(false);
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            });
            const { container: containerNoInviteNotPublic } = render(<RoomHeader room={room} />, getWrapper());
            expect(queryAllByLabelText(containerNoInviteNotPublic, "There's no one here to call")).toHaveLength(2);

            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
            jest.spyOn(room, "canInvite").mockReturnValue(false);
            const { container: containerNoInvitePublic } = render(<RoomHeader room={room} />, getWrapper());
            expect(queryAllByLabelText(containerNoInvitePublic, "There's no one here to call")).toHaveLength(2);

            jest.spyOn(room, "canInvite").mockReturnValue(true);
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Invite);
            const { container: containerInviteNotPublic } = render(<RoomHeader room={room} />, getWrapper());
            expect(queryAllByLabelText(containerInviteNotPublic, "There's no one here to call")).toHaveLength(2);

            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
            jest.spyOn(room, "canInvite").mockReturnValue(true);
            const { container: containerInvitePublic } = render(<RoomHeader room={room} />, getWrapper());
            expect(queryAllByLabelText(containerInvitePublic, "There's no one here to call")).toHaveLength(0);

            // last we can allow everything but without guest_spa_url nothing will work
            guestSpaUrlMock.mockRestore();
            const { container: containerAllAllowedButNoGuestSpaUrl } = render(<RoomHeader room={room} />, getWrapper());
            expect(
                queryAllByLabelText(containerAllAllowedButNoGuestSpaUrl, "There's no one here to call"),
            ).toHaveLength(2);
        });

        it("calls using legacy or jitsi", async () => {
            mockRoomMembers(room, 2);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                return false;
            });
            const { container } = render(<RoomHeader room={room} />, getWrapper());

            const voiceButton = getByLabelText(container, "Voice call");
            const videoButton = getByLabelText(container, "Video call");
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            fireEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            fireEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using legacy or jitsi for large rooms", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                return false;
            });

            const { container } = render(<RoomHeader room={room} />, getWrapper());

            const voiceButton = getByLabelText(container, "Voice call");
            const videoButton = getByLabelText(container, "Video call");
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            fireEvent.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            fireEvent.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using element call for large rooms", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === ElementCall.MEMBER_EVENT_TYPE.name) return true;
                return false;
            });

            const { container } = render(<RoomHeader room={room} />, getWrapper());

            const voiceButton = getByLabelText(container, "Voice call");
            const videoButton = getByLabelText(container, "Video call");
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch");
            fireEvent.click(videoButton);
            expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ view_call: true }));
        });

        it("buttons are disabled if there is an ongoing call", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(CallStore.prototype, "activeCalls", "get").mockReturnValue(
                new Set([{ roomId: "some_other_room" } as Call]),
            );
            const { container } = render(<RoomHeader room={room} />, getWrapper());

            const [videoButton, voiceButton] = getAllByLabelText(container, "Ongoing call");

            expect(voiceButton).toHaveAttribute("aria-disabled", "true");
            expect(videoButton).toHaveAttribute("aria-disabled", "true");
        });

        it("join button is shown if there is an ongoing call", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            const joinButton = getByLabelText(container, "Join");
            expect(joinButton).not.toHaveAttribute("aria-disabled", "true");
        });

        it("join button is disabled if there is an other ongoing call", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            jest.spyOn(CallStore.prototype, "activeCalls", "get").mockReturnValue(
                new Set([{ roomId: "some_other_room" } as Call]),
            );
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            const joinButton = getByLabelText(container, "Ongoing call");

            expect(joinButton).toHaveAttribute("aria-disabled", "true");
        });

        it("close lobby button is shown", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            getByLabelText(container, "Close lobby");
        });

        it("close lobby button is shown if there is an ongoing call but we are viewing the lobby", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

            const { container } = render(<RoomHeader room={room} />, getWrapper());
            getByLabelText(container, "Close lobby");
        });

        it("don't show external conference button if the call is not shown", () => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(false);
            jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            });
            let { container } = render(<RoomHeader room={room} />, getWrapper());
            expect(screen.queryByLabelText(_t("voip|get_call_link"))).not.toBeInTheDocument();

            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

            container = render(<RoomHeader room={room} />, getWrapper()).container;

            expect(getByLabelText(container, _t("voip|get_call_link"))).toBeInTheDocument();
        });
    });

    describe("public room", () => {
        it("shows a globe", () => {
            const joinRuleEvent = new MatrixEvent({
                type: EventType.RoomJoinRules,
                content: { join_rule: JoinRule.Public },
                sender: MatrixClientPeg.get()!.getSafeUserId(),
                state_key: "",
                room_id: room.roomId,
            });
            room.addLiveEvents([joinRuleEvent]);

            const { container } = render(<RoomHeader room={room} />, getWrapper());

            expect(getByLabelText(container, "Public room")).toBeInTheDocument();
        });
    });

    describe("dm", () => {
        let client: MatrixClient;
        beforeEach(() => {
            client = MatrixClientPeg.get()!;

            // Make the mocked room a DM
            jest.spyOn(client, "getAccountData").mockImplementation((eventType: string): MatrixEvent | undefined => {
                if (eventType === EventType.Direct) {
                    return mkEvent({
                        event: true,
                        content: {
                            [client.getUserId()!]: [room.roomId],
                        },
                        type: EventType.Direct,
                        user: client.getSafeUserId(),
                    });
                }

                return undefined;
            });
            jest.spyOn(client, "isCryptoEnabled").mockReturnValue(true);
        });

        it.each([
            [ShieldUtils.E2EStatus.Verified, "Verified"],
            [ShieldUtils.E2EStatus.Warning, "Untrusted"],
        ])("shows the %s icon", async (value: ShieldUtils.E2EStatus, expectedLabel: string) => {
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(value);

            const { container } = render(<RoomHeader room={room} />, getWrapper());

            await waitFor(() => expect(getByLabelText(container, expectedLabel)).toBeInTheDocument());
        });
    });

    it("renders additionalButtons", async () => {
        const additionalButtons: ViewRoomOpts["buttons"] = [
            {
                icon: () => <>test-icon</>,
                id: "test-id",
                label: () => "test-label",
                onClick: () => {},
            },
        ];
        render(<RoomHeader room={room} additionalButtons={additionalButtons} />, getWrapper());
        expect(screen.getByRole("button", { name: "test-label" })).toBeInTheDocument();
    });

    it("calls onClick-callback on additionalButtons", () => {
        const callback = jest.fn();
        const additionalButtons: ViewRoomOpts["buttons"] = [
            {
                icon: () => <>test-icon</>,
                id: "test-id",
                label: () => "test-label",
                onClick: callback,
            },
        ];

        render(<RoomHeader room={room} additionalButtons={additionalButtons} />, getWrapper());

        const button = screen.getByRole("button", { name: "test-label" });
        const event = createEvent.click(button);
        event.stopPropagation = jest.fn();
        fireEvent(button, event);

        expect(callback).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    describe("ask to join disabled", () => {
        it("does not render the RoomKnocksBar", () => {
            render(<RoomHeader room={room} />, getWrapper());
            expect(screen.queryByRole("heading", { name: "Asking to join" })).not.toBeInTheDocument();
        });
    });

    describe("ask to join enabled", () => {
        it("does render the RoomKnocksBar", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_ask_to_join");
            jest.spyOn(room, "canInvite").mockReturnValue(true);
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([new RoomMember(room.roomId, "@foo")]);

            render(<RoomHeader room={room} />, getWrapper());
            expect(screen.getByRole("heading", { name: "Asking to join" })).toBeInTheDocument();
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
            membership: KnownMembership.Join,
            getAvatarUrl: () => `mxc://avatar.url/user-${index}.png`,
            getMxcAvatarUrl: () => `mxc://avatar.url/user-${index}.png`,
        }));

    room.currentState.setJoinedMemberCount(members.length);
    room.getJoinedMembers = jest.fn().mockReturnValue(members);
}
