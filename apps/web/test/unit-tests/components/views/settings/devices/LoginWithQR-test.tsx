/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { cleanup, render, waitFor } from "jest-matrix-react";
import { mocked, type MockedObject } from "jest-mock";
import React, { createRef, type RefObject } from "react";
import {
    ClientRendezvousFailureReason,
    MSC4108FailureReason,
    MSC4108SignInWithQR,
    RendezvousError,
    RendezvousIntent,
} from "matrix-js-sdk/src/rendezvous";
import { HTTPError, type MatrixClient, MatrixHttpApi } from "matrix-js-sdk/src/matrix";

import LoginWithQR, { LoginWithQRFailureReason } from "../../../../../../src/components/views/auth/LoginWithQR";
import { Click, Mode, Phase } from "../../../../../../src/components/views/auth/LoginWithQR-types";

jest.mock("matrix-js-sdk/src/rendezvous/transports");
jest.mock("matrix-js-sdk/src/rendezvous/channels");
jest.mock("matrix-js-sdk/src/rendezvous/channels/MSC4108SecureChannel.ts");

const mockedFlow = jest.fn();

jest.mock("../../../../../../src/components/views/auth/LoginWithQRFlow", () => (props: Record<string, any>) => {
    mockedFlow(props);
    return <div />;
});

function makeClient() {
    const cli = mocked({
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
        getDomain: jest.fn(),
    } as unknown as MatrixClient);

    cli.http = new MatrixHttpApi(cli, {
        baseUrl: "https://server/",
        prefix: "prefix",
        onlyData: true,
    }) as any;

    return cli;
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
        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
    } as const;

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
        const getComponent = (props: {
            client: MatrixClient;
            onFinished?: () => void;
            ref?: RefObject<LoginWithQR | null>;
        }) => <LoginWithQR {...defaultProps} {...props} />;

        test("render QR then back", async () => {
            const onFinished = jest.fn();
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockReturnValue(unresolvedPromise());
            jest.spyOn(MSC4108SignInWithQR.prototype, "generateCode");
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols");
            jest.spyOn(MSC4108SignInWithQR.prototype, "cancel");
            const ref = createRef<LoginWithQR>();
            render(getComponent({ client, onFinished, ref }));

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.ShowingQR,
                    onClick: expect.any(Function),
                    intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                }),
            );

            const rendezvous = ref.current!.state.rendezvous!;
            expect(rendezvous.generateCode).toHaveBeenCalled();
            expect(rendezvous.negotiateProtocols).toHaveBeenCalled();

            // back
            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Back);
            expect(onFinished).toHaveBeenCalledWith(false, undefined);
            expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
        });

        test("should open a new channel if expires before qr scan", async () => {
            const onFinished = jest.fn();
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockReturnValue(unresolvedPromise());
            const ref = createRef<LoginWithQR>();
            render(getComponent({ client, onFinished, ref }));

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.ShowingQR,
                    onClick: expect.any(Function),
                }),
            );

            const rendezvous = ref.current!.state.rendezvous!;
            expect(rendezvous.generateCode).toHaveBeenCalled();
            expect(rendezvous.negotiateProtocols).toHaveBeenCalled();

            // Expire the channel
            rendezvous.onFailure!(ClientRendezvousFailureReason.Expired);
            await jest.runAllTimersAsync();
            await waitFor(() => expect(ref.current!.state.rendezvous).toBeDefined());
            expect(ref.current!.state.rendezvous).not.toBe(rendezvous);
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

        test("should show error if check code doesn't match", async () => {
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
            await onClick(Click.Approve, "12");

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    failureReason: LoginWithQRFailureReason.CheckCodeMismatch,
                    onClick: expect.any(Function),
                }),
            );
        });

        test("reciprocates login", async () => {
            const ref = createRef<LoginWithQR>();
            jest.spyOn(global.window, "open");

            render(getComponent({ client, ref }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "shareSecrets").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({
                verificationUri: "mock-verification-uri",
            });

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    onClick: expect.any(Function),
                    intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                }),
            );

            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Approve);

            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.WaitingForDevice,
                    onClick: expect.any(Function),
                    intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                }),
            );
            expect(global.window.open).toHaveBeenCalledWith("mock-verification-uri", "_blank");

            const rendezvous = ref.current!.state.rendezvous!;
            expect(rendezvous.shareSecrets).toHaveBeenCalled();
        });

        test("handles errors during protocol negotiation", async () => {
            const ref = createRef<LoginWithQR>();
            render(getComponent({ client, ref }));
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
                const rendezvous = ref.current!.state.rendezvous!;
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
                    intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
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
            const ref = createRef<LoginWithQR>();
            render(getComponent({ client, ref }));
            jest.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
            jest.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
            await waitFor(() =>
                expect(mockedFlow).toHaveBeenLastCalledWith({
                    phase: Phase.OutOfBandConfirmation,
                    onClick: expect.any(Function),
                    intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                }),
            );

            jest.spyOn(MSC4108SignInWithQR.prototype, "cancel").mockResolvedValue();
            const onClick = mockedFlow.mock.calls[0][0].onClick;
            await onClick(Click.Cancel);

            const rendezvous = ref.current!.state.rendezvous!;
            expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
        });
    });
});
