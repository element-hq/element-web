/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { cleanup, render, waitFor } from "jest-matrix-react";
import { mocked, type MockedObject } from "jest-mock";
import React from "react";
import {
    ClientRendezvousFailureReason,
    MSC4108FailureReason,
    MSC4108SignInWithQR,
    RendezvousError,
} from "matrix-js-sdk/src/rendezvous";
import { HTTPError, type MatrixClient } from "matrix-js-sdk/src/matrix";

import LoginWithQR from "../../../../../../src/components/views/auth/LoginWithQR";
import { Click, Mode, Phase } from "../../../../../../src/components/views/auth/LoginWithQR-types";

jest.mock("matrix-js-sdk/src/rendezvous");
jest.mock("matrix-js-sdk/src/rendezvous/transports");
jest.mock("matrix-js-sdk/src/rendezvous/channels");

const mockedFlow = jest.fn();

jest.mock("../../../../../../src/components/views/auth/LoginWithQRFlow", () => (props: Record<string, any>) => {
    mockedFlow(props);
    return <div />;
});

function makeClient() {
    return mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        getUserId: jest.fn(),
        on: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
        doesServerSupportUnstableFeature: jest.fn().mockReturnValue(true),
        removeListener: jest.fn(),
        requestLoginToken: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
        getClientWellKnown: jest.fn().mockReturnValue({}),
        getCrypto: jest.fn().mockReturnValue({}),
    } as unknown as MatrixClient);
}

function unresolvedPromise<T>(): Promise<T> {
    return new Promise(() => {});
}

describe("<LoginWithQR />", () => {
    let client!: MockedObject<MatrixClient>;
    const defaultProps = {
        legacy: true,
        mode: Mode.Show,
        onFinished: jest.fn(),
    };

    beforeEach(() => {
        mockedFlow.mockReset();
        jest.resetAllMocks();
        client = makeClient();
    });

    afterEach(() => {
        client = makeClient();
        jest.clearAllMocks();
        jest.useRealTimers();
        cleanup();
    });

    describe("MSC4108", () => {
        const getComponent = (props: { client: MatrixClient; onFinished?: () => void }) => (
            <LoginWithQR {...defaultProps} {...props} />
        );

        test("render QR then back", async () => {
            const onFinished = jest.fn();
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockReturnValue(unresolvedPromise());
            render(getComponent({ client, onFinished }));

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.ShowingQR,
                    onClick: expect.any(Function),
                }),
            );

            const rendezvous = mocked(MSC4108SignInWithQR).mock.instances[0];
            expect(rendezvous.generateCode).toHaveBeenCalled();
            expect(rendezvous.negotiateProtocols).toHaveBeenCalled();

            // back
            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Back);
            expect(onFinished).toHaveBeenCalledWith(false);
            expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
        });

        test("failed to connect", async () => {
            render(getComponent({ client }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockRejectedValue(
                new HTTPError("Internal Server Error", 500),
            );
            const fn = jest.spyOn(MSC4108SignInWithQR.prototype, "cancel");
            await waitFor(() => expect(fn).toHaveBeenLastCalledWith(ClientRendezvousFailureReason.Unknown));
        });

        test("reciprocates login", async () => {
            jest.spyOn(global.window, "open");

            render(getComponent({ client }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({
                verificationUri: "mock-verification-uri",
            });

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    onClick: expect.any(Function),
                }),
            );

            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Approve);

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.WaitingForDevice,
                    onClick: expect.any(Function),
                }),
            );
            expect(global.window.open).toHaveBeenCalledWith("mock-verification-uri", "_blank");
        });

        test("handles errors during protocol negotiation", async () => {
            render(getComponent({ client }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "cancel").mockResolvedValue();
            const err = new RendezvousError("Unknown Failure", MSC4108FailureReason.UnsupportedProtocol);
            // @ts-ignore work-around for lazy mocks
            err.code = MSC4108FailureReason.UnsupportedProtocol;
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockRejectedValue(err);
            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        phase: Phase.ShowingQR,
                    }),
                ),
            );

            await waitFor(() => {
                const rendezvous = mocked(MSC4108SignInWithQR).mock.instances[0];
                expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UnsupportedProtocol);
            });
        });

        test("handles errors during reciprocation", async () => {
            render(getComponent({ client }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    onClick: expect.any(Function),
                }),
            );

            jest.spyOn(MSC4108SignInWithQR.prototype, "shareSecrets").mockRejectedValue(
                new HTTPError("Internal Server Error", 500),
            );
            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Approve);

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        phase: Phase.Error,
                        failureReason: ClientRendezvousFailureReason.Unknown,
                    }),
                ),
            );
        });

        test("handles user cancelling during reciprocation", async () => {
            render(getComponent({ client }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    onClick: expect.any(Function),
                }),
            );

            jest.spyOn(MSC4108SignInWithQR.prototype, "cancel").mockResolvedValue();
            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Cancel);

            const rendezvous = mocked(MSC4108SignInWithQR).mock.instances[0];
            expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
        });
    });
});
