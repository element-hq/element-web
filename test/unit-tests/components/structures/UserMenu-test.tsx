/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { DEVICE_CODE_SCOPE, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { mocked } from "jest-mock";
import fetchMock from "fetch-mock-jest";

import UnwrappedUserMenu from "../../../../src/components/structures/UserMenu";
import { stubClient, wrapInSdkContext } from "../../../test-utils";
import { TestSdkContext } from "../../TestSdkContext";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import LogoutDialog from "../../../../src/components/views/dialogs/LogoutDialog";
import Modal from "../../../../src/Modal";
import { mockOpenIdConfiguration } from "../../../test-utils/oidc";
import { Action } from "../../../../src/dispatcher/actions";
import { UserTab } from "../../../../src/components/views/dialogs/UserTab";

describe("<UserMenu>", () => {
    let client: MatrixClient;
    let sdkContext: TestSdkContext;

    beforeEach(() => {
        sdkContext = new TestSdkContext();
    });

    describe("<UserMenu> logout", () => {
        beforeEach(() => {
            client = stubClient();
        });

        it("should logout directly if no crypto", async () => {
            const UserMenu = wrapInSdkContext(UnwrappedUserMenu, sdkContext);
            render(<UserMenu isPanelCollapsed={true} />);

            mocked(client.getRooms).mockReturnValue([
                {
                    roomId: "!room0",
                } as unknown as Room,
                {
                    roomId: "!room1",
                } as unknown as Room,
            ]);
            jest.spyOn(client, "getCrypto").mockReturnValue(undefined);

            const spy = jest.spyOn(defaultDispatcher, "dispatch");
            screen.getByRole("button", { name: /User menu/i }).click();
            (await screen.findByRole("menuitem", { name: /Sign out/i })).click();
            await waitFor(() => {
                expect(spy).toHaveBeenCalledWith({ action: "logout" });
            });
        });

        it("should logout directly if no encrypted rooms", async () => {
            const UserMenu = wrapInSdkContext(UnwrappedUserMenu, sdkContext);
            render(<UserMenu isPanelCollapsed={true} />);

            mocked(client.getRooms).mockReturnValue([
                {
                    roomId: "!room0",
                } as unknown as Room,
                {
                    roomId: "!room1",
                } as unknown as Room,
            ]);
            const crypto = client.getCrypto()!;

            jest.spyOn(crypto, "isEncryptionEnabledInRoom").mockResolvedValue(false);

            const spy = jest.spyOn(defaultDispatcher, "dispatch");
            screen.getByRole("button", { name: /User menu/i }).click();
            (await screen.findByRole("menuitem", { name: /Sign out/i })).click();
            await waitFor(() => {
                expect(spy).toHaveBeenCalledWith({ action: "logout" });
            });
        });

        it("should show dialog if some encrypted rooms", async () => {
            const UserMenu = wrapInSdkContext(UnwrappedUserMenu, sdkContext);
            render(<UserMenu isPanelCollapsed={true} />);

            mocked(client.getRooms).mockReturnValue([
                {
                    roomId: "!room0",
                } as unknown as Room,
                {
                    roomId: "!room1",
                } as unknown as Room,
            ]);
            const crypto = client.getCrypto()!;

            jest.spyOn(crypto, "isEncryptionEnabledInRoom").mockImplementation(async (roomId: string) => {
                return roomId === "!room0";
            });

            const spy = jest.spyOn(Modal, "createDialog");
            screen.getByRole("button", { name: /User menu/i }).click();
            (await screen.findByRole("menuitem", { name: /Sign out/i })).click();

            await waitFor(() => {
                expect(spy).toHaveBeenCalledWith(LogoutDialog);
            });
        });
    });

    it("should render 'Link new device' button in OIDC native mode", async () => {
        sdkContext.client = stubClient();
        mocked(sdkContext.client.getAuthIssuer).mockResolvedValue({ issuer: "https://issuer/" });
        const openIdMetadata = mockOpenIdConfiguration("https://issuer/");
        openIdMetadata.grant_types_supported.push(DEVICE_CODE_SCOPE);
        fetchMock.get("https://issuer/.well-known/openid-configuration", openIdMetadata);
        fetchMock.get("https://issuer/jwks", {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
            keys: [],
        });
        mocked(sdkContext.client.getVersions).mockResolvedValue({
            versions: [],
            unstable_features: {
                "org.matrix.msc4108": true,
            },
        });
        mocked(sdkContext.client.waitForClientWellKnown).mockResolvedValue({});
        mocked(sdkContext.client.getCrypto).mockReturnValue({
            isCrossSigningReady: jest.fn().mockResolvedValue(true),
            exportSecretsBundle: jest.fn().mockResolvedValue({}),
        } as unknown as CryptoApi);
        const spy = jest.spyOn(defaultDispatcher, "dispatch");

        const UserMenu = wrapInSdkContext(UnwrappedUserMenu, sdkContext);
        render(<UserMenu isPanelCollapsed={true} />);

        screen.getByRole("button", { name: /User menu/i }).click();
        await expect(screen.findByText("Link new device")).resolves.toBeInTheDocument();

        // Assert the QR code is shown directly
        screen.getByRole("menuitem", { name: "Link new device" }).click();
        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.SessionManager,
                props: { showMsc4108QrCode: true },
            });
        });
    });
});
