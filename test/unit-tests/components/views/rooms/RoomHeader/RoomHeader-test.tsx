/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { CallType, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import {
    EventType,
    JoinRule,
    MatrixEvent,
    PendingEventOrdering,
    Room,
    RoomStateEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { CryptoEvent, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import {
    act,
    createEvent,
    fireEvent,
    getAllByLabelText,
    getByLabelText,
    getByText,
    queryAllByLabelText,
    queryByLabelText,
    render,
    type RenderOptions,
    screen,
    waitFor,
} from "jest-matrix-react";
import { type ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import { filterConsole, stubClient } from "../../../../../test-utils";
import RoomHeader from "../../../../../../src/components/views/rooms/RoomHeader/RoomHeader";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import RightPanelStore from "../../../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../../../src/stores/right-panel/RightPanelStorePhases";
import LegacyCallHandler from "../../../../../../src/LegacyCallHandler";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../../../src/SdkConfig";
import dispatcher from "../../../../../../src/dispatcher/dispatcher";
import { CallStore } from "../../../../../../src/stores/CallStore";
import { type Call, ElementCall } from "../../../../../../src/models/Call";
import * as ShieldUtils from "../../../../../../src/utils/ShieldUtils";
import { Container, WidgetLayoutStore } from "../../../../../../src/stores/widgets/WidgetLayoutStore";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { _t } from "../../../../../../src/languageHandler";
import * as UseCall from "../../../../../../src/hooks/useCall";
import { SdkContextClass } from "../../../../../../src/contexts/SDKContext";
import WidgetStore, { type IApp } from "../../../../../../src/stores/WidgetStore";
import { UIFeature } from "../../../../../../src/settings/UIFeature";

jest.mock("../../../../../../src/utils/ShieldUtils");
jest.mock("../../../../../../src/hooks/right-panel/useCurrentPhase", () => ({
    useCurrentPhase: () => {
        return { currentPhase: "foo", isOpen: false };
    },
}));

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
        jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(ShieldUtils.E2EStatus.Normal);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the room header", () => {
        const { container } = render(<RoomHeader room={room} />, getWrapper());
        expect(container).toHaveTextContent(ROOM_ID);
    });

    it("opens the room summary", async () => {
        const user = userEvent.setup();
        const { container } = render(<RoomHeader room={room} />, getWrapper());

        await user.click(getByText(container, ROOM_ID));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomSummary });
    });

    it("shows a face pile for rooms", async () => {
        const user = userEvent.setup();
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

        const facePile = getByLabelText(document.body, "4 members");
        expect(facePile).toHaveTextContent("4");

        await user.click(facePile);

        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList });
    });

    it("has room info icon that opens the room info panel", async () => {
        const user = userEvent.setup();
        const { getAllByRole } = render(<RoomHeader room={room} />, getWrapper());
        const infoButton = getAllByRole("button", { name: "Room info" })[1];
        await user.click(infoButton);
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomSummary });
    });

    it("opens the thread panel", async () => {
        const user = userEvent.setup();
        render(<RoomHeader room={room} />, getWrapper());

        await user.click(getByLabelText(document.body, "Threads"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel });
    });

    it("opens the notifications panel", async () => {
        const user = userEvent.setup();
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string): any => {
            if (name === "feature_notifications") return true;
        });

        render(<RoomHeader room={room} />, getWrapper());

        await user.click(getByLabelText(document.body, "Notifications"));
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.NotificationPanel });
    });

    it("should show both call buttons in rooms smaller than 3 members", async () => {
        mockRoomMembers(room, 2);
        render(<RoomHeader room={room} />, getWrapper());

        const voiceButton = screen.getByRole("button", { name: "Voice call" });
        const videoButton = screen.getByRole("button", { name: "Video call" });
        expect(videoButton).toBeInTheDocument();
        expect(voiceButton).toBeInTheDocument();
    });

    it("should not show voice call button in managed hybrid environments", async () => {
        mockRoomMembers(room, 2);
        jest.spyOn(SdkConfig, "get").mockReturnValue({ widget_build_url: "https://widget.build.url" });
        render(<RoomHeader room={room} />, getWrapper());

        const videoButton = screen.getByRole("button", { name: "Video call" });
        expect(videoButton).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Voice call" })).not.toBeInTheDocument();
    });

    it("should not show voice call button in rooms larger than 2 members", async () => {
        mockRoomMembers(room, 3);
        render(<RoomHeader room={room} />, getWrapper());

        const videoButton = screen.getByRole("button", { name: "Video call" });
        expect(videoButton).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Voice call" })).not.toBeInTheDocument();
    });

    describe("UIFeature.Widgets enabled (default)", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature == UIFeature.Widgets);
        });

        it("should show call buttons in a room with 2 members", () => {
            mockRoomMembers(room, 2);
            render(<RoomHeader room={room} />, getWrapper());
            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).toBeInTheDocument();
        });

        it("should show call buttons in a room with more than 2 members", () => {
            mockRoomMembers(room, 3);
            render(<RoomHeader room={room} />, getWrapper());
            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).toBeInTheDocument();
        });
    });

    describe("UIFeature.Widgets disabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => false);
        });

        it("should show call buttons in a room with 2 members", () => {
            mockRoomMembers(room, 2);
            render(<RoomHeader room={room} />, getWrapper());

            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).toBeInTheDocument();
        });

        it("should not show call buttons in a room with more than 2 members", () => {
            mockRoomMembers(room, 3);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            expect(queryByLabelText(container, "Video call")).not.toBeInTheDocument();
        });
    });

    describe("groups call disabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature == UIFeature.Widgets);
        });

        it("you can't call if you're alone", () => {
            mockRoomMembers(room, 1);
            const { container } = render(<RoomHeader room={room} />, getWrapper());
            for (const button of getAllByLabelText(container, "There's no one here to call")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
        });

        it("you can call when you're two in the room", async () => {
            const user = userEvent.setup();
            mockRoomMembers(room, 2);
            render(<RoomHeader room={room} />, getWrapper());

            const voiceButton = screen.getByRole("button", { name: "Voice call" });
            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");

            await user.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            await user.click(videoButton);
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

        it("can call in large rooms if able to edit widgets", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            render(<RoomHeader room={room} />, getWrapper());

            const videoCallButton = screen.getByRole("button", { name: "Video call" });
            expect(videoCallButton).not.toHaveAttribute("aria-disabled", "true");
        });

        it("disable calls in large rooms by default", () => {
            mockRoomMembers(room, 10);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(false);
            render(<RoomHeader room={room} />, getWrapper());
            expect(
                getByLabelText(document.body, "You do not have permission to start video calls", {
                    selector: "button",
                }),
            ).toHaveAttribute("aria-disabled", "true");
        });
    });

    describe("group call enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (feature) => feature === "feature_group_calls" || feature == UIFeature.Widgets,
            );
        });

        it("renders only the video call element", async () => {
            const user = userEvent.setup();
            mockRoomMembers(room, 3);
            jest.spyOn(SdkConfig, "get").mockReturnValue({ use_exclusively: true });
            // allow element calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);

            render(<RoomHeader room={room} />, getWrapper());

            expect(screen.queryByTitle("Voice call")).toBeNull();

            const videoCallButton = screen.getByRole("button", { name: "Video call" });
            expect(videoCallButton).not.toHaveAttribute("aria-disabled", "true");

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch").mockImplementation();

            await user.click(videoCallButton);
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
                off: () => {},
            } as unknown as Call);
            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);
            render(<RoomHeader room={room} />, getWrapper());
            expect(screen.getByRole("button", { name: "Ongoing call" })).toHaveAttribute("aria-disabled", "true");
        });

        it("clicking on ongoing (unpinned) call re-pins it", async () => {
            const user = userEvent.setup();
            mockRoomMembers(room, 3);
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature == UIFeature.Widgets);
            // allow calls
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
            jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(false);
            const spy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");

            const widget = { type: "m.jitsi" } as IApp;
            jest.spyOn(CallStore.instance, "getCall").mockReturnValue({
                widget,
                on: () => {},
                off: () => {},
            } as unknown as Call);
            jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue([widget]);

            render(<RoomHeader room={room} />, getWrapper());

            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");
            await user.click(videoButton);
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
            const user = userEvent.setup();
            mockRoomMembers(room, 2);
            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                return false;
            });
            render(<RoomHeader room={room} />, getWrapper());

            const voiceButton = screen.getByRole("button", { name: "Voice call" });
            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(voiceButton).not.toHaveAttribute("aria-disabled", "true");
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            await user.click(voiceButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Voice);

            await user.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using legacy or jitsi for large rooms", async () => {
            const user = userEvent.setup();
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === "im.vector.modular.widgets") return true;
                return false;
            });

            render(<RoomHeader room={room} />, getWrapper());

            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall");
            await user.click(videoButton);
            expect(placeCallSpy).toHaveBeenLastCalledWith(room.roomId, CallType.Video);
        });

        it("calls using element call for large rooms", async () => {
            const user = userEvent.setup();
            mockRoomMembers(room, 3);

            jest.spyOn(room.currentState, "mayClientSendStateEvent").mockImplementation((key) => {
                if (key === ElementCall.MEMBER_EVENT_TYPE.name) return true;
                return false;
            });

            render(<RoomHeader room={room} />, getWrapper());

            const videoButton = screen.getByRole("button", { name: "Video call" });
            expect(videoButton).not.toHaveAttribute("aria-disabled", "true");

            const dispatcherSpy = jest.spyOn(dispatcher, "dispatch").mockImplementation();
            await user.click(videoButton);
            expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ view_call: true }));
        });

        it("buttons are disabled if there is an ongoing call", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(CallStore.prototype, "connectedCalls", "get").mockReturnValue(
                new Set([{ roomId: "some_other_room" } as Call]),
            );
            const { container } = render(<RoomHeader room={room} />, getWrapper());

            const [videoButton] = getAllByLabelText(container, "Ongoing call");

            expect(videoButton).toHaveAttribute("aria-disabled", "true");
        });

        it("join button is shown if there is an ongoing call", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            render(<RoomHeader room={room} />, getWrapper());
            const joinButton = getByLabelText(document.body, "Join");
            expect(joinButton).not.toHaveAttribute("aria-disabled", "true");
        });

        it("join button is disabled if there is an other ongoing call", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            jest.spyOn(CallStore.prototype, "connectedCalls", "get").mockReturnValue(
                new Set([{ roomId: "some_other_room" } as Call]),
            );
            render(<RoomHeader room={room} />, getWrapper());
            const joinButton = getByLabelText(document.body, "Ongoing call");

            expect(joinButton).toHaveAttribute("aria-disabled", "true");
        });

        it("close lobby button is shown", async () => {
            mockRoomMembers(room, 3);

            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);
            render(<RoomHeader room={room} />, getWrapper());
            getByLabelText(document.body, "Close lobby");
        });

        it("close lobby button is shown if there is an ongoing call but we are viewing the lobby", async () => {
            mockRoomMembers(room, 3);
            jest.spyOn(UseCall, "useParticipantCount").mockReturnValue(3);
            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

            render(<RoomHeader room={room} />, getWrapper());
            getByLabelText(document.body, "Close lobby");
        });

        it("don't show external conference button if the call is not shown", () => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(false);
            jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            });
            render(<RoomHeader room={room} />, getWrapper());
            expect(screen.queryByLabelText(_t("voip|get_call_link"))).not.toBeInTheDocument();

            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

            render(<RoomHeader room={room} />, getWrapper());

            expect(getByLabelText(document.body, _t("voip|get_call_link"))).toBeInTheDocument();
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
            room.addLiveEvents([joinRuleEvent], { addToState: true });

            render(<RoomHeader room={room} />, getWrapper());

            expect(getByLabelText(document.body, "Public room")).toBeInTheDocument();
        });
    });

    describe("dm", () => {
        beforeEach(() => {
            // Make the mocked room a DM
            mocked(DMRoomMap.shared().getUserIdForRoomId).mockImplementation((roomId) => {
                if (roomId === room.roomId) return "@user:example.com";
            });
            room.getMember = jest.fn((userId) => new RoomMember(room.roomId, userId));
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
                {
                    userId: "@bob:example.org",
                    name: "Other Member",
                    rawDisplayName: "Other Member",
                    roomId: room.roomId,
                    membership: KnownMembership.Join,
                    getAvatarUrl: () => "mxc://avatar.url/image.png",
                    getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
                },
            ]);
        });

        it.each([
            [ShieldUtils.E2EStatus.Verified, "Verified"],
            [ShieldUtils.E2EStatus.Warning, "Untrusted"],
        ])("shows the %s icon", async (value: ShieldUtils.E2EStatus, expectedLabel: string) => {
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(value);

            render(<RoomHeader room={room} />, getWrapper());

            await waitFor(() => expect(getByLabelText(document.body, expectedLabel)).toBeInTheDocument());
        });

        it("does not show the face pile for DMs", () => {
            const { asFragment } = render(<RoomHeader room={room} />, getWrapper());

            expect(asFragment()).toMatchSnapshot();
        });

        it("updates the icon when the encryption status changes", async () => {
            // The room starts verified
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(ShieldUtils.E2EStatus.Verified);
            render(<RoomHeader room={room} />, getWrapper());
            await waitFor(() => expect(getByLabelText(document.body, "Verified")).toBeInTheDocument());

            // A new member joins, and the room becomes unverified
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(ShieldUtils.E2EStatus.Warning);
            act(() => {
                room.emit(
                    RoomStateEvent.Members,
                    new MatrixEvent({
                        event_id: "$event_id",
                        type: EventType.RoomMember,
                        state_key: "@alice:example.org",
                        content: {
                            membership: "join",
                        },
                        room_id: ROOM_ID,
                        sender: "@alice:example.org",
                    }),
                    room.currentState,
                    new RoomMember(room.roomId, "@alice:example.org"),
                );
            });
            await waitFor(() => expect(getByLabelText(document.body, "Untrusted")).toBeInTheDocument());

            // The user becomes verified
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(ShieldUtils.E2EStatus.Verified);
            act(() => {
                MatrixClientPeg.get()!.emit(
                    CryptoEvent.UserTrustStatusChanged,
                    "@alice:example.org",
                    new UserVerificationStatus(true, true, true, false),
                );
            });
            await waitFor(() => expect(getByLabelText(document.body, "Verified")).toBeInTheDocument());

            // An unverified device is added
            jest.spyOn(ShieldUtils, "shieldStatusForRoom").mockResolvedValue(ShieldUtils.E2EStatus.Warning);
            act(() => {
                MatrixClientPeg.get()!.emit(CryptoEvent.DevicesUpdated, ["@alice:example.org"], false);
            });
            await waitFor(() => expect(getByLabelText(document.body, "Untrusted")).toBeInTheDocument());
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

    it("should open room settings when clicking the room avatar", async () => {
        const user = userEvent.setup();
        render(<RoomHeader room={room} />, getWrapper());

        const dispatcherSpy = jest.spyOn(dispatcher, "dispatch");
        await user.click(getByLabelText(document.body, "Open room settings"));
        expect(dispatcherSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "open_room_settings" }));
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
