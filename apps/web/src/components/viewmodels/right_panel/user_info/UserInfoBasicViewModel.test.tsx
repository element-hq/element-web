/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventType, type MatrixClient, MatrixEvent, type Room, RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { renderHook, waitFor } from "test-utils-rtl";
import { createTestClient, mkRoom, withClientContextRenderOptions } from "test-utils";

import { useUserInfoBasicViewModel } from "./UserInfoBasicViewModel";
import DMRoomMap from "../../../../utils/DMRoomMap";
import Modal from "../../../../Modal";
import QuestionDialog from "../../../views/dialogs/QuestionDialog";

describe("useUserInfoHeaderViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    let mockClient: MatrixClient;

    let defaultProps: {
        member: User | RoomMember;
        room: Room;
    };

    let room: Room;

    beforeEach(() => {
        mockClient = createTestClient();
        mockClient.isSynapseAdministrator = vi.fn().mockResolvedValue(true);
        mockClient.deactivateSynapseUser = vi.fn().mockResolvedValue({
            id_server_unbind_result: "success",
        });

        room = mkRoom(mockClient, defaultRoomId);
        defaultProps = {
            member: defaultMember,
            room,
        };
        DMRoomMap.makeShared(mockClient);
        vi.spyOn(mockClient, "getRoom").mockReturnValue(room);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const renderUserInfoBasicViewModelHook = (
        props: {
            member: User | RoomMember;
            room: Room;
        } = defaultProps,
    ) => {
        return renderHook(
            () => useUserInfoBasicViewModel(props.room, props.member),
            withClientContextRenderOptions(mockClient),
        );
    };

    it("should set showDeactivateButton value to true", async () => {
        vi.spyOn(mockClient, "getDomain").mockReturnValue("example.com");
        const { result } = renderUserInfoBasicViewModelHook();
        // checking the synpase admin is an async operation, that is why we wait for it
        await waitFor(() => {
            expect(result.current.showDeactivateButton).toBe(true);
        });
    });

    it("should set showDeactivateButton value to false because domain is not the same", async () => {
        vi.spyOn(mockClient, "getDomain").mockReturnValue("toto.com");
        const { result } = renderUserInfoBasicViewModelHook();

        await waitFor(() => {
            expect(result.current.showDeactivateButton).toBe(false);
        });
    });

    it("should give powerlevels values", () => {
        const powerLevelEvents = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: {
                invite: 1,
                state_default: 1,
            },
        });
        vi.spyOn(room.currentState, "getStateEvents").mockReturnValue(powerLevelEvents);
        const { result } = renderUserInfoBasicViewModelHook();
        expect(result.current.powerLevels).toStrictEqual({
            invite: 1,
            state_default: 1,
        });
    });

    it("should set isRoomDMForMember to true if found in dmroommap", () => {
        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue("id");
        const { result } = renderUserInfoBasicViewModelHook();
        expect(result.current.isRoomDMForMember).toBeTruthy();
    });

    it("should set isRoomDMForMember to false if not found in dmroommap", () => {
        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(undefined);
        const { result } = renderUserInfoBasicViewModelHook();
        expect(result.current.isRoomDMForMember).toBeFalsy();
    });

    it("should display modal and call deactivateSynapseUser when calling onSynapaseDeactivate", async () => {
        const powerLevelEvents = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: {
                invite: 1,
                state_default: 1,
            },
        });
        vi.spyOn(room.currentState, "getStateEvents").mockReturnValue(powerLevelEvents);
        vi.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true, true, false]),
            close: vi.fn(),
        } as any);

        const { result } = renderUserInfoBasicViewModelHook();

        await waitFor(() => result.current.onSynapseDeactivate());

        await waitFor(() => {
            expect(Modal.createDialog).toHaveBeenLastCalledWith(QuestionDialog, {
                button: "Deactivate user",
                danger: true,
                description: (
                    <div>
                        Deactivating this user will remove their devices and prevent them from logging back in.
                        Additionally, they will leave all the rooms they are in. This action cannot be reversed. Are you
                        sure you want to deactivate this user?
                    </div>
                ),
                title: "Deactivate user?",
            });
        });
        expect(mockClient.deactivateSynapseUser).toHaveBeenCalledWith(defaultMember.userId);
    });
});
