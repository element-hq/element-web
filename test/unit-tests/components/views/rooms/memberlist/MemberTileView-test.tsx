/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { type MatrixClient, RoomMember as SdkRoomMember, type Device, Room } from "matrix-js-sdk/src/matrix";
import { type UserVerificationStatus, type DeviceVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import * as TestUtils from "../../../../../test-utils";
import { type RoomMember } from "../../../../../../src/models/rooms/RoomMember";
import {
    getPending3PidInvites,
    sdkRoomMemberToRoomMember,
} from "../../../../../../src/components/viewmodels/memberlist/MemberListViewModel";
import { RoomMemberTileView } from "../../../../../../src/components/views/rooms/MemberList/tiles/RoomMemberTileView";
import { ThreePidInviteTileView } from "../../../../../../src/components/views/rooms/MemberList/tiles/ThreePidInviteTileView";

describe("MemberTileView", () => {
    describe("RoomMemberTileView", () => {
        let matrixClient: MatrixClient;
        let member: RoomMember;

        beforeEach(() => {
            matrixClient = TestUtils.stubClient();
            mocked(matrixClient.isRoomEncrypted).mockReturnValue(true);
            const sdkMember = new SdkRoomMember("roomId", matrixClient.getUserId()!);
            member = sdkRoomMemberToRoomMember(sdkMember)!.member!;
        });

        it("should not display an E2EIcon when the e2E status = normal", () => {
            const { container } = render(<RoomMemberTileView member={member} />);
            const e2eIcon = container.querySelector(".mx_E2EIconView");
            expect(e2eIcon).toBeNull();
            expect(container).toMatchSnapshot();
        });

        it("should display an warning E2EIcon when the e2E status = Warning", async () => {
            mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
                isCrossSigningVerified: jest.fn().mockReturnValue(false),
                wasCrossSigningVerified: jest.fn().mockReturnValue(true),
            } as unknown as UserVerificationStatus);

            const { container } = render(<RoomMemberTileView member={member} />);
            await waitFor(async () => {
                await userEvent.hover(container.querySelector(".mx_E2EIcon")!);
                expect(screen.getByText("This user has not verified all of their sessions.")).toBeInTheDocument();
            });
            expect(container).toMatchSnapshot();
        });

        it("should display an verified E2EIcon when the e2E status = Verified", async () => {
            // Mock all the required crypto methods
            const deviceMap = new Map<string, Map<string, Device>>();
            deviceMap.set(member.userId, new Map([["deviceId", {} as Device]]));
            // Return a DeviceMap = Map<string, Map<string, Device>>
            mocked(matrixClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(deviceMap);
            mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
                isCrossSigningVerified: jest.fn().mockReturnValue(true),
            } as unknown as UserVerificationStatus);
            mocked(matrixClient.getCrypto()!.getDeviceVerificationStatus).mockResolvedValue({
                crossSigningVerified: true,
            } as DeviceVerificationStatus);

            const { container } = render(<RoomMemberTileView member={member} />);

            await waitFor(async () => {
                await userEvent.hover(container.querySelector(".mx_E2EIcon")!);
                expect(
                    screen.getByText("You have verified this user. This user has verified all of their sessions."),
                ).toBeInTheDocument();
            });
            expect(container).toMatchSnapshot();
        });

        it("renders user labels correctly", async () => {
            member.powerLevel = 50;
            const { container: container1 } = render(<RoomMemberTileView member={member} />);
            expect(container1).toHaveTextContent("Moderator");

            member.powerLevel = 100;
            const { container: container2 } = render(<RoomMemberTileView member={member} />);
            expect(container2).toHaveTextContent("Admin");

            member.isInvite = true;
            const { container: container3 } = render(<RoomMemberTileView member={member} />);
            expect(container3).toHaveTextContent("Invited");
        });
    });

    describe("ThreePidInviteTileView", () => {
        let cli: MatrixClient;
        let room: Room;

        beforeEach(() => {
            cli = TestUtils.stubClient();
            room = new Room("!mytestroom:foo.org", cli, cli.getSafeUserId());
            room.getLiveTimeline().addEvent(
                TestUtils.mkThirdPartyInviteEvent(cli.getSafeUserId(), "Foobar", room.roomId),
                { toStartOfTimeline: false, addToState: true },
            );
        });

        it("renders ThreePidInvite correctly", async () => {
            const [{ threePidInvite }] = getPending3PidInvites(room);
            const { container } = render(<ThreePidInviteTileView threePidInvite={threePidInvite!} />);
            expect(container).toMatchSnapshot();
        });
    });
});
