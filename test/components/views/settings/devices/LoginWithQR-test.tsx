/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { cleanup, render, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";
import React from "react";
import { MSC3906Rendezvous, RendezvousFailureReason } from "matrix-js-sdk/src/rendezvous";
import { LoginTokenPostResponse } from "matrix-js-sdk/src/@types/auth";

import LoginWithQR, { Click, Mode, Phase } from "../../../../../src/components/views/auth/LoginWithQR";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

jest.mock("matrix-js-sdk/src/rendezvous");
jest.mock("matrix-js-sdk/src/rendezvous/transports");
jest.mock("matrix-js-sdk/src/rendezvous/channels");

const mockedFlow = jest.fn();

jest.mock("../../../../../src/components/views/auth/LoginWithQRFlow", () => (props: Record<string, any>) => {
    mockedFlow(props);
    return <div />;
});

function makeClient() {
    return mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        isCryptoEnabled: jest.fn(),
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
    } as unknown as MatrixClient);
}

function unresolvedPromise<T>(): Promise<T> {
    return new Promise(() => {});
}

describe("<LoginWithQR />", () => {
    let client = makeClient();
    const defaultProps = {
        mode: Mode.Show,
        onFinished: jest.fn(),
    };
    const mockConfirmationDigits = "mock-confirmation-digits";
    const mockRendezvousCode = "mock-rendezvous-code";
    const newDeviceId = "new-device-id";

    const getComponent = (props: { client: MatrixClient; onFinished?: () => void }) => (
        <React.StrictMode>
            <LoginWithQR {...defaultProps} {...props} />
        </React.StrictMode>
    );

    beforeEach(() => {
        mockedFlow.mockReset();
        jest.resetAllMocks();
        jest.spyOn(MSC3906Rendezvous.prototype, "generateCode").mockResolvedValue();
        // @ts-ignore
        // workaround for https://github.com/facebook/jest/issues/9675
        MSC3906Rendezvous.prototype.code = mockRendezvousCode;
        jest.spyOn(MSC3906Rendezvous.prototype, "cancel").mockResolvedValue();
        jest.spyOn(MSC3906Rendezvous.prototype, "startAfterShowingCode").mockResolvedValue(mockConfirmationDigits);
        jest.spyOn(MSC3906Rendezvous.prototype, "declineLoginOnExistingDevice").mockResolvedValue();
        jest.spyOn(MSC3906Rendezvous.prototype, "approveLoginOnExistingDevice").mockResolvedValue(newDeviceId);
        jest.spyOn(MSC3906Rendezvous.prototype, "verifyNewDeviceOnExistingDevice").mockResolvedValue(undefined);
        client.requestLoginToken.mockResolvedValue({
            login_token: "token",
            expires_in: 1000, // this is as per MSC3882 r0
            expires_in_ms: 1000 * 1000, // this is as per MSC3882 r1
        } as LoginTokenPostResponse); // we force the type here so that it works with versions of js-sdk that don't have r1 support yet
    });

    afterEach(() => {
        client = makeClient();
        jest.clearAllMocks();
        jest.useRealTimers();
        cleanup();
    });

    test("no homeserver support", async () => {
        // simulate no support
        jest.spyOn(MSC3906Rendezvous.prototype, "generateCode").mockRejectedValue("");
        render(getComponent({ client }));
        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith({
                phase: Phase.Error,
                failureReason: RendezvousFailureReason.HomeserverLacksSupport,
                onClick: expect.any(Function),
            }),
        );
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        expect(rendezvous.generateCode).toHaveBeenCalled();
    });

    test("failed to connect", async () => {
        jest.spyOn(MSC3906Rendezvous.prototype, "startAfterShowingCode").mockRejectedValue("");
        render(getComponent({ client }));
        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith({
                phase: Phase.Error,
                failureReason: RendezvousFailureReason.Unknown,
                onClick: expect.any(Function),
            }),
        );
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();
    });

    test("render QR then cancel and try again", async () => {
        const onFinished = jest.fn();
        jest.spyOn(MSC3906Rendezvous.prototype, "startAfterShowingCode").mockImplementation(() => unresolvedPromise());
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.ShowingQR,
                }),
            ),
        );
        // display QR code
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.ShowingQR,
            code: mockRendezvousCode,
            onClick: expect.any(Function),
        });
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();

        // cancel
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        await onClick(Click.Cancel);
        expect(onFinished).toHaveBeenCalledWith(false);
        expect(rendezvous.cancel).toHaveBeenCalledWith(RendezvousFailureReason.UserCancelled);

        // try again
        onClick(Click.TryAgain);
        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.ShowingQR,
                }),
            ),
        );
        // display QR code
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.ShowingQR,
            code: mockRendezvousCode,
            onClick: expect.any(Function),
        });
    });

    test("render QR then back", async () => {
        const onFinished = jest.fn();
        jest.spyOn(MSC3906Rendezvous.prototype, "startAfterShowingCode").mockReturnValue(unresolvedPromise());
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.ShowingQR,
                }),
            ),
        );
        // display QR code
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.ShowingQR,
            code: mockRendezvousCode,
            onClick: expect.any(Function),
        });
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();

        // back
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        await onClick(Click.Back);
        expect(onFinished).toHaveBeenCalledWith(false);
        expect(rendezvous.cancel).toHaveBeenCalledWith(RendezvousFailureReason.UserCancelled);
    });

    test("render QR then decline", async () => {
        const onFinished = jest.fn();
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.Connected,
                }),
            ),
        );
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.Connected,
            confirmationDigits: mockConfirmationDigits,
            onClick: expect.any(Function),
        });

        // decline
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        await onClick(Click.Decline);
        expect(onFinished).toHaveBeenCalledWith(false);

        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();
        expect(rendezvous.declineLoginOnExistingDevice).toHaveBeenCalled();
    });

    test("approve - no crypto", async () => {
        // @ts-ignore
        client.crypto = undefined;
        const onFinished = jest.fn();
        // jest.spyOn(MSC3906Rendezvous.prototype, 'approveLoginOnExistingDevice').mockReturnValue(unresolvedPromise());
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.Connected,
                }),
            ),
        );
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.Connected,
            confirmationDigits: mockConfirmationDigits,
            onClick: expect.any(Function),
        });
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();

        // approve
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        await onClick(Click.Approve);

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.WaitingForDevice,
                }),
            ),
        );

        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalledWith("token");

        expect(onFinished).toHaveBeenCalledWith(true);
    });

    test("approve + verifying", async () => {
        const onFinished = jest.fn();
        // @ts-ignore
        client.crypto = {};
        jest.spyOn(MSC3906Rendezvous.prototype, "verifyNewDeviceOnExistingDevice").mockImplementation(() =>
            unresolvedPromise(),
        );
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.Connected,
                }),
            ),
        );
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.Connected,
            confirmationDigits: mockConfirmationDigits,
            onClick: expect.any(Function),
        });
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();

        // approve
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        onClick(Click.Approve);

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.Verifying,
                }),
            ),
        );

        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalledWith("token");
        expect(rendezvous.verifyNewDeviceOnExistingDevice).toHaveBeenCalled();
        // expect(onFinished).toHaveBeenCalledWith(true);
    });

    test("approve + verify", async () => {
        const onFinished = jest.fn();
        // @ts-ignore
        client.crypto = {};
        render(getComponent({ client, onFinished }));
        const rendezvous = mocked(MSC3906Rendezvous).mock.instances[0];

        await waitFor(() =>
            expect(mockedFlow).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    phase: Phase.Connected,
                }),
            ),
        );
        expect(mockedFlow).toHaveBeenLastCalledWith({
            phase: Phase.Connected,
            confirmationDigits: mockConfirmationDigits,
            onClick: expect.any(Function),
        });
        expect(rendezvous.generateCode).toHaveBeenCalled();
        expect(rendezvous.startAfterShowingCode).toHaveBeenCalled();

        // approve
        const onClick = mockedFlow.mock.calls[0][0].onClick;
        await onClick(Click.Approve);
        expect(rendezvous.approveLoginOnExistingDevice).toHaveBeenCalledWith("token");
        expect(rendezvous.verifyNewDeviceOnExistingDevice).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalledWith(true);
    });
});
