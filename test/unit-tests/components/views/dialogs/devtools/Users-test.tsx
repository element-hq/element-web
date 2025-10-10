/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { Device, DeviceVerification, type MatrixClient, MatrixEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "jest-matrix-react";
import { Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import { type DeviceVerificationStatus, type UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import { createTestClient } from "../../../../../test-utils";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { DevtoolsContext } from "../../../../../../src/components/views/dialogs/devtools/BaseTool";
import { UserList } from "../../../../../../src/components/views/dialogs/devtools/Users";

const userId = "@alice:example.com";

describe("<Users />", () => {
    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = createTestClient();
    });

    it("should render a user list", () => {
        const room = new Room("!roomId", matrixClient, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        room.getJoinedMembers = jest.fn().mockReturnValue([]);

        const { asFragment } = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <DevtoolsContext.Provider value={{ room }}>
                    <UserList onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a single user", async () => {
        const room = new Room("!roomId", matrixClient, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const alice = new RoomMember("!roomId", userId);
        alice.setMembershipEvent(
            new MatrixEvent({
                content: {
                    membership: "join",
                },
                state_key: userId,
                room_id: "!roomId",
                type: "m.room.member",
                sender: userId,
            }),
        );
        room.getJoinedMembers = jest.fn().mockReturnValue([alice]);

        mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
            isCrossSigningVerified: jest.fn().mockReturnValue(true),
            wasCrossSigningVerified: jest.fn().mockReturnValue(true),
            needsUserApproval: false,
        } as unknown as UserVerificationStatus);
        mocked(matrixClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        [
                            "VERIFIED",
                            new Device({
                                deviceId: "VERIFIED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:VERIFIED", "an_ed25519_public_key"],
                                    ["curve25519:VERIFIED", "a_curve25519_public_key"],
                                ]),
                            }),
                        ],
                        [
                            "SIGNED",
                            new Device({
                                deviceId: "SIGNED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:SIGNED", "an_ed25519_public_key"],
                                    ["curve25519:SIGNED", "a_curve25519_public_key"],
                                ]),
                            }),
                        ],
                        [
                            "UNSIGNED",
                            new Device({
                                deviceId: "UNSIGNED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:UNSIGNED", "an_ed25519_public_key"],
                                    ["curve25519:UNSIGNED", "a_curve25519_public_key"],
                                ]),
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mocked(matrixClient.getCrypto()!.getDeviceVerificationStatus).mockImplementation(
            async (userId: string, deviceId: string) => {
                switch (deviceId) {
                    case "VERIFIED":
                        return {
                            signedByOwner: true,
                            crossSigningVerified: true,
                        } as unknown as DeviceVerificationStatus;
                    case "SIGNED":
                        return {
                            signedByOwner: true,
                            crossSigningVerified: false,
                        } as unknown as DeviceVerificationStatus;
                    case "UNSIGNED":
                        return {
                            signedByOwner: false,
                            crossSigningVerified: false,
                        } as unknown as DeviceVerificationStatus;
                    default:
                        return null;
                }
            },
        );

        const { asFragment } = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <DevtoolsContext.Provider value={{ room }}>
                    <UserList onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );

        screen.getByRole("button", { name: userId }).click();

        await waitFor(() => expect(screen.getByText(/Verification status:/)).toHaveTextContent(/Verified/));
        await waitFor(() => expect(screen.getByRole("button", { name: "VERIFIED" })).toBeInTheDocument());

        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a single device - verified by cross-signing", async () => {
        const room = new Room("!roomId", matrixClient, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const alice = new RoomMember("!roomId", userId);
        alice.setMembershipEvent(
            new MatrixEvent({
                content: {
                    membership: "join",
                },
                state_key: userId,
                room_id: "!roomId",
                type: "m.room.member",
                sender: userId,
            }),
        );
        room.getJoinedMembers = jest.fn().mockReturnValue([alice]);

        mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
            isCrossSigningVerified: jest.fn().mockReturnValue(true),
            wasCrossSigningVerified: jest.fn().mockReturnValue(true),
            needsUserApproval: false,
        } as unknown as UserVerificationStatus);
        mocked(matrixClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        [
                            "VERIFIED",
                            new Device({
                                deviceId: "VERIFIED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:VERIFIED", "an_ed25519_public_key"],
                                    ["curve25519:VERIFIED", "a_curve25519_public_key"],
                                ]),
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mocked(matrixClient.getCrypto()!.getDeviceVerificationStatus).mockResolvedValue({
            signedByOwner: true,
            crossSigningVerified: true,
        } as unknown as DeviceVerificationStatus);

        const { asFragment } = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <DevtoolsContext.Provider value={{ room }}>
                    <UserList onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );

        screen.getByRole("button", { name: userId }).click();

        await waitFor(() => expect(screen.getByRole("button", { name: "VERIFIED" })).toBeInTheDocument());
        screen.getByRole("button", { name: "VERIFIED" }).click();

        await waitFor(() =>
            expect(screen.getByText(/Verification status:/)).toHaveTextContent(/Verified by cross-signing/),
        );

        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a single device - signed by owner", async () => {
        const room = new Room("!roomId", matrixClient, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const alice = new RoomMember("!roomId", userId);
        alice.setMembershipEvent(
            new MatrixEvent({
                content: {
                    membership: "join",
                },
                state_key: userId,
                room_id: "!roomId",
                type: "m.room.member",
                sender: userId,
            }),
        );
        room.getJoinedMembers = jest.fn().mockReturnValue([alice]);

        mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
            isCrossSigningVerified: jest.fn().mockReturnValue(true),
            wasCrossSigningVerified: jest.fn().mockReturnValue(true),
            needsUserApproval: false,
        } as unknown as UserVerificationStatus);
        mocked(matrixClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        [
                            "SIGNED",
                            new Device({
                                deviceId: "SIGNED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:SIGNED", "an_ed25519_public_key"],
                                    ["curve25519:SIGNED", "a_curve25519_public_key"],
                                ]),
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mocked(matrixClient.getCrypto()!.getDeviceVerificationStatus).mockResolvedValue({
            signedByOwner: true,
            crossSigningVerified: false,
        } as unknown as DeviceVerificationStatus);

        const { asFragment } = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <DevtoolsContext.Provider value={{ room }}>
                    <UserList onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );

        screen.getByRole("button", { name: userId }).click();

        await waitFor(() => expect(screen.getByRole("button", { name: "SIGNED" })).toBeInTheDocument());
        screen.getByRole("button", { name: "SIGNED" }).click();

        await waitFor(() => expect(screen.getByText(/Verification status:/)).toHaveTextContent(/Signed by owner/));

        expect(asFragment()).toMatchSnapshot();
    });

    it("should render a single device - unsigned", async () => {
        const room = new Room("!roomId", matrixClient, userId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const alice = new RoomMember("!roomId", userId);
        alice.setMembershipEvent(
            new MatrixEvent({
                content: {
                    membership: "join",
                },
                state_key: userId,
                room_id: "!roomId",
                type: "m.room.member",
                sender: userId,
            }),
        );
        room.getJoinedMembers = jest.fn().mockReturnValue([alice]);

        mocked(matrixClient.getCrypto()!.getUserVerificationStatus).mockResolvedValue({
            isCrossSigningVerified: jest.fn().mockReturnValue(true),
            wasCrossSigningVerified: jest.fn().mockReturnValue(true),
            needsUserApproval: false,
        } as unknown as UserVerificationStatus);
        mocked(matrixClient.getCrypto()!.getUserDeviceInfo).mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        [
                            "UNSIGNED",
                            new Device({
                                deviceId: "UNSIGNED",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([
                                    ["ed25519:UNSIGNED", "an_ed25519_public_key"],
                                    ["curve25519:UNSIGNED", "a_curve25519_public_key"],
                                ]),
                                verified: DeviceVerification.Verified,
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mocked(matrixClient.getCrypto()!.getDeviceVerificationStatus).mockResolvedValue({
            signedByOwner: false,
            crossSigningVerified: false,
        } as unknown as DeviceVerificationStatus);

        const { asFragment } = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <DevtoolsContext.Provider value={{ room }}>
                    <UserList onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );

        screen.getByRole("button", { name: userId }).click();

        await waitFor(() => expect(screen.getByText(/Verification status:/)).toHaveTextContent(/Verified/));

        await waitFor(() => expect(screen.getByRole("button", { name: "UNSIGNED" })).toBeInTheDocument());
        screen.getByRole("button", { name: "UNSIGNED" }).click();

        await waitFor(() => expect(screen.getByText(/Verification status:/)).toHaveTextContent(/Not signed by owner/));

        expect(asFragment()).toMatchSnapshot();
    });
});
