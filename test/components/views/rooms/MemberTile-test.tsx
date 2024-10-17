/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MatrixClient, RoomMember, Device } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus, DeviceVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import * as TestUtils from "../../../test-utils";
import MemberTile from "../../../../src/components/views/rooms/MemberTile";

describe("MemberTile", () => {
    let matrixClient: MatrixClient;
    let member: RoomMember;

    beforeEach(() => {
        matrixClient = TestUtils.stubClient();
        mocked(matrixClient.isRoomEncrypted).mockReturnValue(true);
        member = new RoomMember("roomId", matrixClient.getUserId()!);
    });

    it("should not display an E2EIcon when the e2E status = normal", () => {
        const { container } = render(<MemberTile member={member} />);

        expect(container).toMatchSnapshot();
    });

    it("should display an warning E2EIcon when the e2E status = Warning", async () => {
        mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
            isCrossSigningVerified: jest.fn().mockReturnValue(false),
            wasCrossSigningVerified: jest.fn().mockReturnValue(true),
        } as unknown as UserVerificationStatus);

        const { container } = render(<MemberTile member={member} />);

        expect(container).toMatchSnapshot();
        await waitFor(async () => {
            await userEvent.hover(container.querySelector(".mx_E2EIcon")!);
            expect(
                screen.getByRole("tooltip", { name: "This user has not verified all of their sessions." }),
            ).toBeInTheDocument();
        });
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

        const { container } = render(<MemberTile member={member} />);

        expect(container).toMatchSnapshot();
        await waitFor(async () => {
            await userEvent.hover(container.querySelector(".mx_E2EIcon")!);
            expect(
                screen.getByRole("tooltip", {
                    name: "You have verified this user. This user has verified all of their sessions.",
                }),
            ).toBeInTheDocument();
        });
    });
});
