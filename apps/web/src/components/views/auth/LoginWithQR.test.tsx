/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, test, expect, beforeEach, afterEach, vi, type MockedObject } from "vitest";
import { cleanup, render, waitFor } from "test-utils-rtl";
import React, { createRef, type RefObject } from "react";
import {
    ClientRendezvousFailureReason,
    MSC4108FailureReason,
    MSC4108SignInWithQR,
    RendezvousError,
    RendezvousIntent,
} from "matrix-js-sdk/src/rendezvous";
import { makeDelegatedAuthMetadata } from "matrix-js-sdk/src/testing";
import {
    AutoDiscovery,
    AutoDiscoveryAction,
    HTTPError,
    type MatrixClient,
    MatrixHttpApi,
    OAuthGrantType,
} from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";
import { mockPlatformPeg } from "test-utils";

import LoginWithQR, { LoginWithQRFailureReason } from "./LoginWithQR";
import { Click, Mode, Phase } from "./LoginWithQR-types";

vi.mock("matrix-js-sdk/src/rendezvous/transports");
vi.mock("matrix-js-sdk/src/rendezvous/channels");
vi.mock("matrix-js-sdk/src/rendezvous/channels/MSC4108SecureChannel.ts");

const mockedFlow = vi.fn();

vi.mock("./LoginWithQRFlow", () => ({
    default: (props: Record<string, any>) => {
        mockedFlow(props);
        return <div />;
    },
}));

function makeClient() {
    const cli = {
        getUser: vi.fn(),
        isGuest: vi.fn().mockReturnValue(false),
        isUserIgnored: vi.fn(),
        getUserId: vi.fn(),
        on: vi.fn(),
        isSynapseAdministrator: vi.fn().mockResolvedValue(false),
        isRoomEncrypted: vi.fn().mockReturnValue(false),
        mxcUrlToHttp: vi.fn().mockReturnValue("mock-mxcUrlToHttp"),
        doesServerSupportUnstableFeature: vi.fn().mockReturnValue(true),
        removeListener: vi.fn(),
        requestLoginToken: vi.fn(),
        currentState: {
            on: vi.fn(),
        },
        getClientWellKnown: vi.fn().mockReturnValue({}),
        getCrypto: vi.fn().mockReturnValue({}),
        getDomain: vi.fn(),
        getAuthMetadata: vi.fn().mockReturnValue(makeDelegatedAuthMetadata()),
    } as unknown as MockedObject<MatrixClient>;

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
        onFinished: vi.fn(),
    } as const;

    beforeEach(() => {
        mockedFlow.mockReset();
        vi.resetAllMocks();
        client = makeClient();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        cleanup();
    });

    describe("MSC4108", () => {
        describe("reciprocate", () => {
            const getComponent = (props: {
                client: MatrixClient;
                onFinished?: () => void;
                ref?: RefObject<LoginWithQR | null>;
            }) => (
                <LoginWithQR
                    {...defaultProps}
                    {...props}
                    intent={RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE}
                />
            );

            test("render QR then back", async () => {
                const onFinished = vi.fn();
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockReturnValue(unresolvedPromise());
                vi.spyOn(MSC4108SignInWithQR.prototype, "generateCode");
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols");
                vi.spyOn(MSC4108SignInWithQR.prototype, "cancel");
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

                // back (cancel)
                const onClick = mockedFlow.mock.calls[0][0].onClick;
                await onClick(Click.Cancel);
                expect(onFinished).toHaveBeenCalledWith(false);
                expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
            });

            test("should open a new channel if expires before qr scan", async () => {
                const onFinished = vi.fn();
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockReturnValue(unresolvedPromise());
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

                // Expire the channel
                rendezvous.onFailure!(ClientRendezvousFailureReason.Expired);
                await waitFor(() => expect(ref.current!.state.rendezvous).toBeDefined(), { timeout: 2000 });
                expect(ref.current!.state.rendezvous).not.toBe(rendezvous);
            });

            test("failed to connect", async () => {
                render(getComponent({ client }));
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockRejectedValue(
                    new HTTPError("Internal Server Error", 500),
                );
                const fn = vi.spyOn(MSC4108SignInWithQR.prototype, "cancel");
                await waitFor(() => expect(fn).toHaveBeenLastCalledWith(ClientRendezvousFailureReason.Unknown));
            });

            test("should show error if check code doesn't match", async () => {
                vi.spyOn(global.window, "open");

                render(getComponent({ client }));
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({
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
                await onClick(Click.Approve, "12");

                await waitFor(() =>
                    expect(mockedFlow).toHaveBeenLastCalledWith({
                        phase: Phase.OutOfBandConfirmation,
                        failureReason: LoginWithQRFailureReason.CheckCodeMismatch,
                        onClick: expect.any(Function),
                        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                    }),
                );
            });

            test("reciprocates login", async () => {
                const ref = createRef<LoginWithQR>();
                vi.spyOn(global.window, "open");

                render(getComponent({ client, ref }));
                vi.spyOn(MSC4108SignInWithQR.prototype, "shareSecrets").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({
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
                vi.spyOn(MSC4108SignInWithQR.prototype, "cancel").mockResolvedValue();
                const err = new RendezvousError("Unknown Failure", MSC4108FailureReason.UnsupportedProtocol);
                // @ts-ignore work-around for lazy mocks
                err.code = MSC4108FailureReason.UnsupportedProtocol;
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockRejectedValue(err);
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
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
                await waitFor(() =>
                    expect(mockedFlow).toHaveBeenLastCalledWith({
                        phase: Phase.OutOfBandConfirmation,
                        onClick: expect.any(Function),
                        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                    }),
                );

                vi.spyOn(MSC4108SignInWithQR.prototype, "shareSecrets").mockRejectedValue(
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
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({});
                await waitFor(() =>
                    expect(mockedFlow).toHaveBeenLastCalledWith({
                        phase: Phase.OutOfBandConfirmation,
                        onClick: expect.any(Function),
                        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE,
                    }),
                );

                vi.spyOn(MSC4108SignInWithQR.prototype, "cancel").mockResolvedValue();
                const onClick = mockedFlow.mock.calls[0][0].onClick;
                await onClick(Click.Cancel);

                const rendezvous = ref.current!.state.rendezvous!;
                expect(rendezvous.cancel).toHaveBeenCalledWith(MSC4108FailureReason.UserCancelled);
            });
        });

        describe("login", () => {
            const getComponent = (props: {
                client: MatrixClient;
                onFinished?: () => void;
                onLoggedIn?: () => Promise<void>;
                ref?: RefObject<LoginWithQR | null>;
            }) => (
                <LoginWithQR
                    onLoggedIn={vi.fn()}
                    {...defaultProps}
                    {...props}
                    intent={RendezvousIntent.LOGIN_ON_NEW_DEVICE}
                />
            );

            it("should handle qr login", async () => {
                fetchMock.get("https://hs/_matrix/client/versions", {
                    unstable_features: {},
                    versions: ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9", "v1.15"],
                });
                const authMetadata = makeDelegatedAuthMetadata("https://auth.org/", [
                    OAuthGrantType.DeviceAuthorization,
                ]);
                fetchMock.get("https://hs/_matrix/client/v1/auth_metadata", authMetadata);
                fetchMock.post(authMetadata.registration_endpoint!, {
                    client_id: "!client_id!",
                });

                mockPlatformPeg({
                    getOAuthClientMetadata: vi.fn().mockReturnValue({
                        client_name: "App name",
                        client_uri: "https://company",
                        redirect_uris: ["https://app"],
                        logo_uri: "https://company/logo.png",
                        application_type: "web",
                    }),
                });

                const ref = createRef<LoginWithQR>();

                render(getComponent({ client, ref }));
                vi.spyOn(MSC4108SignInWithQR.prototype, "shareSecrets").mockResolvedValue({
                    secrets: {
                        cross_signing: {
                            master_key: "mk",
                            self_signing_key: "ssk",
                            user_signing_key: "usk",
                        },
                    },
                });
                vi.spyOn(MSC4108SignInWithQR.prototype, "negotiateProtocols").mockResolvedValue({ serverName: "hs" });
                vi.spyOn(MSC4108SignInWithQR.prototype, "deviceAuthorizationGrant").mockResolvedValue({
                    userCode: "123456",
                });
                vi.spyOn(MSC4108SignInWithQR.prototype, "completeLoginOnNewDevice").mockResolvedValue({
                    access_token: "token",
                    token_type: "Bearer",
                });
                vi.spyOn(AutoDiscovery, "findClientConfig").mockResolvedValue({
                    "m.homeserver": { base_url: "https://hs", state: AutoDiscoveryAction.SUCCESS },
                    "m.identity_server": { state: AutoDiscoveryAction.PROMPT },
                });

                await waitFor(() =>
                    expect(mockedFlow).toHaveBeenLastCalledWith({
                        phase: Phase.OutOfBandConfirmation,
                        onClick: expect.any(Function),
                        intent: RendezvousIntent.LOGIN_ON_NEW_DEVICE,
                    }),
                );

                const onClick = mockedFlow.mock.calls[0][0].onClick;
                await onClick(Click.Approve);

                await waitFor(() =>
                    expect(mockedFlow).toHaveBeenLastCalledWith({
                        phase: Phase.WaitingForDevice,
                        onClick: expect.any(Function),
                        intent: RendezvousIntent.LOGIN_ON_NEW_DEVICE,
                        userCode: "123456",
                    }),
                );

                const rendezvous = ref.current!.state.rendezvous!;
                expect(rendezvous.shareSecrets).toHaveBeenCalled();
            });
        });
    });
});
