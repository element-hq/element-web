/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { type Mocked, mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import CrossSigningPanel from "../../../../../src/components/views/settings/CrossSigningPanel";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../../test-utils";
import Modal from "../../../../../src/Modal";
import ConfirmDestroyCrossSigningDialog from "../../../../../src/components/views/dialogs/security/ConfirmDestroyCrossSigningDialog";

describe("<CrossSigningPanel />", () => {
    const userId = "@alice:server.org";
    let mockClient: Mocked<MatrixClient>;
    const getComponent = () => render(<CrossSigningPanel />);

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            ...mockClientMethodsCrypto(),
            doesServerSupportUnstableFeature: jest.fn(),
        });

        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should render a spinner while loading", () => {
        getComponent();

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should render when homeserver does not support cross-signing", async () => {
        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(false);

        getComponent();
        await flushPromises();

        expect(screen.getByText("Your homeserver does not support cross-signing.")).toBeInTheDocument();
    });

    describe("when cross signing is ready", () => {
        it("should render when keys are not backed up", async () => {
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual(
                "⚠️ Cross-signing is ready but keys are not backed up.",
            );
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
        });

        it("should render when keys are backed up", async () => {
            mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
                publicKeysOnDevice: true,
                privateKeysInSecretStorage: true,
                privateKeysCachedLocally: {
                    masterKey: true,
                    selfSigningKey: true,
                    userSigningKey: true,
                },
            });
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual("✅ Cross-signing is ready for use.");
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
        });

        it("should allow reset of cross-signing", async () => {
            mockClient.getCrypto()!.bootstrapCrossSigning = jest.fn().mockResolvedValue(undefined);
            getComponent();
            await flushPromises();

            const modalSpy = jest.spyOn(Modal, "createDialog");

            screen.getByRole("button", { name: "Reset" }).click();
            expect(modalSpy).toHaveBeenCalledWith(ConfirmDestroyCrossSigningDialog, expect.any(Object));
            modalSpy.mock.lastCall![1]!.onFinished(true);
            expect(mockClient.getCrypto()!.bootstrapCrossSigning).toHaveBeenCalledWith(
                expect.objectContaining({ setupNewCrossSigning: true }),
            );
        });
    });

    describe("when cross signing is not ready", () => {
        beforeEach(() => {
            mocked(mockClient.getCrypto()!.isCrossSigningReady).mockResolvedValue(false);
        });

        it("should render when keys are not backed up", async () => {
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual("Cross-signing is not set up.");
        });

        it("should render when keys are backed up", async () => {
            mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
                publicKeysOnDevice: true,
                privateKeysInSecretStorage: true,
                privateKeysCachedLocally: {
                    masterKey: true,
                    selfSigningKey: true,
                    userSigningKey: true,
                },
            });
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual(
                "Your account has a cross-signing identity in secret storage, but it is not yet trusted by this session.",
            );
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
        });
    });
});
