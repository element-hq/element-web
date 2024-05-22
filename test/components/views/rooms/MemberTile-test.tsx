/*
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
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
