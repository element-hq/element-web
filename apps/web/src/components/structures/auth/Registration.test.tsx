/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "test-utils-rtl";
import { createClient, type MatrixClient, MatrixError, type ValidatedAuthMetadata } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";
import { getMockClientWithEventEmitter, mkServerConfig, mockPlatformPeg, unmockPlatformPeg } from "test-utils";
import { makeDelegatedAuthMetadata } from "test-utils/auth";

import SdkConfig, { DEFAULTS } from "../../../SdkConfig";
import Registration from "./Registration";
import { startOAuthLogin } from "../../../utils/oauth/authorize";

vi.mock("../../../utils/oauth/authorize", () => ({
    startOAuthLogin: vi.fn(),
}));

vi.mock("matrix-js-sdk/src/matrix", async () => ({
    ...(await vi.importActual("matrix-js-sdk/src/matrix")),
    createClient: vi.fn(),
}));

/** The matrix versions our mock server claims to support */
const SERVER_SUPPORTED_MATRIX_VERSIONS = ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9"];

describe("Registration", function () {
    let mockClient!: MockedObject<MatrixClient>;

    beforeEach(function () {
        SdkConfig.put({
            ...DEFAULTS,
            disable_custom_urls: true,
        });
        mockClient = getMockClientWithEventEmitter({
            registerRequest: vi.fn(),
            loginFlows: vi.fn(),
            getVersions: vi.fn().mockResolvedValue({ versions: SERVER_SUPPORTED_MATRIX_VERSIONS }),
        });
        mockClient.registerRequest.mockRejectedValueOnce(
            new MatrixError(
                {
                    flows: [{ stages: [] }],
                },
                401,
            ),
        );
        mockClient.loginFlows.mockResolvedValue({ flows: [{ type: "m.login.password" }] });
        vi.mocked(createClient).mockImplementation((opts) => {
            mockClient.idBaseUrl = opts.idBaseUrl;
            mockClient.baseUrl = opts.baseUrl;
            return mockClient;
        });
        fetchMock.catch(404);
        fetchMock.get("https://matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
        });
        mockPlatformPeg({
            startSingleSignOn: vi.fn(),
        });
    });

    afterEach(function () {
        vi.restoreAllMocks();
        SdkConfig.reset(); // we touch the config, so clean up
        unmockPlatformPeg();
    });

    const defaultProps = {
        defaultDeviceDisplayName: "test-device-display-name",
        onLoggedIn: vi.fn(),
        onLoginClick: vi.fn(),
        onServerConfigChange: vi.fn(),
    };

    const defaultHsUrl = "https://matrix.org";
    const defaultIsUrl = "https://vector.im";

    function getRawComponent(
        hsUrl = defaultHsUrl,
        isUrl = defaultIsUrl,
        authConfig?: ValidatedAuthMetadata,
        mobileRegister?: boolean,
    ) {
        return (
            <Registration
                {...defaultProps}
                serverConfig={mkServerConfig(hsUrl, isUrl, authConfig)}
                mobileRegister={mobileRegister}
            />
        );
    }

    function getComponent(
        hsUrl?: string,
        isUrl?: string,
        authConfig?: ValidatedAuthMetadata,
        mobileRegister?: boolean,
    ) {
        return render(getRawComponent(hsUrl, isUrl, authConfig, mobileRegister));
    }

    it("should show server picker", async function () {
        const { container } = getComponent();
        expect(container.querySelector(".mx_ServerPicker")).toBeTruthy();
    });

    it("should show form when custom URLs disabled", async function () {
        const { container } = getComponent();
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));
        expect(container.querySelector("form")).toBeTruthy();
    });

    it("should show SSO options if those are available", async () => {
        mockClient.loginFlows.mockClear().mockResolvedValue({ flows: [{ type: "m.login.sso" }] });
        const { container } = getComponent();
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));

        const ssoButton = container.querySelector(".mx_SSOButton");
        expect(ssoButton).toBeTruthy();
    });

    it("should handle serverConfig updates correctly", async () => {
        mockClient.loginFlows.mockResolvedValue({
            flows: [
                {
                    type: "m.login.sso",
                },
            ],
        });

        const { container, rerender } = render(getRawComponent());
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));

        fireEvent.click(container.querySelector(".mx_SSOButton")!);
        expect(mockClient.baseUrl).toBe("https://matrix.org");

        fetchMock.get("https://server2/_matrix/client/versions", {
            unstable_features: {},
            versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
        });
        rerender(getRawComponent("https://server2"));
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));

        fireEvent.click(container.querySelector(".mx_SSOButton")!);
        expect(mockClient.baseUrl).toBe("https://server2");
    });

    describe("when delegated authentication is configured and enabled", () => {
        const authConfig = makeDelegatedAuthMetadata();
        const clientId = "test-client-id";
        authConfig.prompt_values_supported = ["create"];

        beforeEach(() => {
            // mock a statically registered client to avoid dynamic registration
            SdkConfig.put({
                oidc_static_clients: {
                    [authConfig.issuer]: {
                        client_id: clientId,
                    },
                },
            });
        });

        it("should display oidc-native continue button", async () => {
            const { container } = getComponent(defaultHsUrl, defaultIsUrl, authConfig);
            await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));
            // no form
            expect(container.querySelector("form")).toBeFalsy();

            expect(await screen.findByText("Continue")).toBeTruthy();
        });

        it("should start OIDC login flow as registration on button click", async () => {
            getComponent(defaultHsUrl, defaultIsUrl, authConfig);
            await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));

            fireEvent.click(await screen.findByText("Continue"));

            expect(startOAuthLogin).toHaveBeenCalledWith(
                authConfig,
                clientId,
                defaultHsUrl,
                defaultIsUrl,
                // isRegistration
                true,
            );
        });

        describe("when is mobile registeration", () => {
            it("should not show server picker", async function () {
                const { container } = getComponent(defaultHsUrl, defaultIsUrl, undefined, true);
                expect(container.querySelector(".mx_ServerPicker")).toBeFalsy();
            });

            it("should show username field with autocaps disabled", async function () {
                const { container } = getComponent(defaultHsUrl, defaultIsUrl, undefined, true);

                await waitFor(() =>
                    expect(container.querySelector("#mx_RegistrationForm_username")).toHaveAttribute(
                        "autocapitalize",
                        "none",
                    ),
                );
            });

            it("should show password and confirm password fields in separate rows", async function () {
                const { container } = getComponent(defaultHsUrl, defaultIsUrl, undefined, true);

                await waitFor(() => expect(container.querySelector("#mx_RegistrationForm_username")).toBeTruthy());
                // when password and confirm password fields are in separate rows there should be 4 rather than 3
                expect(container.querySelectorAll(".mx_AuthBody_fieldRow")).toHaveLength(4);
            });
        });
    });
});
