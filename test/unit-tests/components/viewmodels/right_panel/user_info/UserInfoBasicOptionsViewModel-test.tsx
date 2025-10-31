/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    EventType,
    KnownMembership,
    type MatrixClient,
    MatrixEvent,
    type Room,
    RoomMember,
    type User,
} from "matrix-js-sdk/src/matrix";
import { renderHook, waitFor } from "jest-matrix-react";

import { Action } from "../../../../../../src/dispatcher/actions";
import Modal from "../../../../../../src/Modal";
import MultiInviter from "../../../../../../src/utils/MultiInviter";
import { createTestClient, mkRoom, withClientContextRenderOptions } from "../../../../../test-utils";
import dis from "../../../../../../src/dispatcher/dispatcher";
import { useUserInfoBasicOptionsViewModel } from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicOptionsViewModel";
import DMRoomMap from "../../../../../../src/utils/DMRoomMap";
import ErrorDialog from "../../../../../../src/components/views/dialogs/ErrorDialog";

jest.mock("../../../../../../src/dispatcher/dispatcher");

describe("<UserOptionsSection />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";
    const meUserId = "@me:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    let defaultProps: { room: Room; member: User | RoomMember };
    let mockClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        mockClient = createTestClient();
        room = mkRoom(mockClient, defaultRoomId);
        defaultProps = {
            member: defaultMember,
            room,
        };
        DMRoomMap.makeShared(mockClient);
    });

    const renderUserInfoBasicOptionsViewModelHook = (
        props: {
            member: User | RoomMember;
            room: Room;
        } = defaultProps,
    ) => {
        return renderHook(
            () => useUserInfoBasicOptionsViewModel(props.room, props.member),
            withClientContextRenderOptions(mockClient),
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the current user account id. Which is different to the defaultMember which is the selected one
        // When we want to mock the current user, needs to override this value
        jest.spyOn(mockClient, "getUserId").mockReturnValue(meUserId);
        jest.spyOn(mockClient, "getRoom").mockReturnValue(room);
    });

    it("should showInviteButton if current user can invite and selected user membership is LEAVE", () => {
        // cant use mkRoomMember because instanceof check will failed in this case
        const member: RoomMember = new RoomMember(defaultMember.userId, defaultMember.roomId);
        const me: RoomMember = new RoomMember(meUserId, defaultMember.roomId);

        console.log("member instanceof RoomMember", member instanceof RoomMember);

        member.powerLevel = 1;
        member.membership = KnownMembership.Leave;
        me.powerLevel = 50;
        me.membership = KnownMembership.Join;
        const powerLevelEvents = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: {
                invite: 50,
                state_default: 0,
            },
        });
        jest.spyOn(room.currentState, "getStateEvents").mockReturnValue(powerLevelEvents);
        // used to get the current me user
        jest.spyOn(room, "getMember").mockReturnValue(me);
        const { result } = renderUserInfoBasicOptionsViewModelHook({ ...defaultProps, member });

        expect(result.current.showInviteButton).toBeTruthy();
    });

    it("should not showInviteButton if current cannot invite", () => {
        const member: RoomMember = new RoomMember(defaultMember.userId, defaultMember.roomId);
        const me: RoomMember = new RoomMember(meUserId, defaultMember.roomId);
        member.powerLevel = 50;
        member.membership = KnownMembership.Leave;
        me.powerLevel = 0;
        me.membership = KnownMembership.Join;
        const powerLevelEvents = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: {
                invite: 50,
                state_default: 0,
            },
        });
        jest.spyOn(room.currentState, "getStateEvents").mockReturnValue(powerLevelEvents);
        // used to get the current me user
        jest.spyOn(room, "getMember").mockReturnValue(me);
        const { result } = renderUserInfoBasicOptionsViewModelHook({ ...defaultProps, member });

        expect(result.current.showInviteButton).toBeFalsy();
    });

    it("should not showInviteButton if selected user membership is not LEAVE", () => {
        const member: RoomMember = new RoomMember(defaultMember.userId, defaultMember.roomId);
        const me: RoomMember = new RoomMember(meUserId, defaultMember.roomId);
        member.powerLevel = 50;
        member.membership = KnownMembership.Join;
        me.powerLevel = 50;
        me.membership = KnownMembership.Join;
        const powerLevelEvents = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: {
                invite: 50,
                state_default: 0,
            },
        });
        jest.spyOn(room.currentState, "getStateEvents").mockReturnValue(powerLevelEvents);
        jest.spyOn(room, "getMember").mockReturnValue(me);
        const { result } = renderUserInfoBasicOptionsViewModelHook({ ...defaultProps, member });

        expect(result.current.showInviteButton).toBeFalsy();
    });

    it("should showInsertPillButton if room is not a space", () => {
        jest.spyOn(room, "isSpaceRoom").mockReturnValue(false);
        const { result } = renderUserInfoBasicOptionsViewModelHook();
        expect(result.current.showInsertPillButton).toBeTruthy();
    });

    it("should not showInsertPillButton if room is a space", () => {
        jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);
        const { result } = renderUserInfoBasicOptionsViewModelHook();
        expect(result.current.showInsertPillButton).toBeFalsy();
    });

    it("should readReceiptButtonDisabled be true if all messages where read", () => {
        jest.spyOn(room, "getEventReadUpTo").mockReturnValue(null);
        const { result } = renderUserInfoBasicOptionsViewModelHook();
        expect(result.current.readReceiptButtonDisabled).toBeTruthy();
    });

    it("should readReceiptButtonDisabled be false if some messages are available", () => {
        jest.spyOn(room, "getEventReadUpTo").mockReturnValue("aneventId");
        const { result } = renderUserInfoBasicOptionsViewModelHook();
        expect(result.current.readReceiptButtonDisabled).toBeFalsy();
    });

    it("should readReceiptButtonDisabled be true if room is a space", () => {
        jest.spyOn(room, "getEventReadUpTo").mockReturnValue("aneventId");
        jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);
        const { result } = renderUserInfoBasicOptionsViewModelHook();
        expect(result.current.readReceiptButtonDisabled).toBeTruthy();
    });

    it("firing onReadReceiptButton calls dispatch with correct event_id", () => {
        const eventId = "aneventId";
        jest.spyOn(room, "getEventReadUpTo").mockReturnValue(eventId);
        jest.spyOn(room, "isSpaceRoom").mockReturnValue(false);
        const { result } = renderUserInfoBasicOptionsViewModelHook();

        result.current.onReadReceiptButton();

        expect(dis.dispatch).toHaveBeenCalledWith({
            action: "view_room",
            event_id: eventId,
            highlighted: true,
            metricsTrigger: undefined,
            room_id: defaultRoomId,
        });
    });

    it("calling onInsertPillButton should calls dispatch", () => {
        const { result } = renderUserInfoBasicOptionsViewModelHook();

        result.current.onInsertPillButton();

        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            userId: defaultMember.userId,
            timelineRenderingType: "Room",
        });
    });

    it("calling onInviteUserButton will call MultiInviter.invite", async () => {
        // to save mocking, we will reject the call to .invite
        const mockErrorMessage = new Error("test error message");
        const spy = jest.spyOn(MultiInviter.prototype, "invite");
        spy.mockRejectedValue(mockErrorMessage);
        jest.spyOn(Modal, "createDialog");

        const { result } = renderUserInfoBasicOptionsViewModelHook();
        result.current.onInviteUserButton("roomId", new Event("click"));

        // check that we have called .invite
        expect(spy).toHaveBeenCalledWith([defaultMember.userId]);

        await waitFor(() => {
            // check that the test error message is displayed
            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                description: "test error message",
                title: "Failed to invite",
            });
        });
    });
});
