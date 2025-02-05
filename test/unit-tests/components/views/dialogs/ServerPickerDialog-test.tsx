/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import fetchMock from "fetch-mock-jest";

import ServerPickerDialog from "../../../../../src/components/views/dialogs/ServerPickerDialog";
import SdkConfig from "../../../../../src/SdkConfig";
import { flushPromises } from "../../../../test-utils";
import { type ValidatedServerConfig } from "../../../../../src/utils/ValidatedServerConfig";

/** The matrix versions our mock server claims to support */
const SERVER_SUPPORTED_MATRIX_VERSIONS = ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9"];

describe("<ServerPickerDialog />", () => {
    const defaultServerConfig = {
        hsUrl: "https://matrix.org",
        hsName: "matrix.org",
        hsNameIsDifferent: true,
        isUrl: "https://is.org",
        isDefault: true,
        isNameResolvable: true,
        warning: "",
    };
    const wkHsUrl = "https://hsbaseurlfrom.wk";
    const wkIsUrl = "https://isbaseurlfrom.wk";
    const validWellKnown = {
        "m.homeserver": {
            base_url: wkHsUrl,
        },
        "m.identity_server": {
            base_url: wkIsUrl,
        },
    };
    const defaultProps = {
        serverConfig: defaultServerConfig,
        onFinished: jest.fn(),
    };
    const getComponent = (
        props: Partial<{
            onFinished: any;
            serverConfig: ValidatedServerConfig;
        }> = {},
    ) => render(<ServerPickerDialog {...defaultProps} {...props} />);

    beforeEach(() => {
        SdkConfig.add({
            validated_server_config: defaultServerConfig,
        });

        fetchMock.resetHistory();
        fetchMock.catch({
            status: 404,
            body: '{"errcode": "M_UNRECOGNIZED", "error": "Unrecognized request"}',
            headers: { "content-type": "application/json" },
        });
    });

    it("should render dialog", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    // checkbox and text input have the same aria-label
    const getOtherHomeserverCheckBox = () =>
        screen.getAllByLabelText("Other homeserver").find((node) => node.getAttribute("type") === "radio")!;
    const getOtherHomeserverInput = () =>
        screen.getAllByLabelText("Other homeserver").find((node) => node.getAttribute("type") === "text")!;

    describe("when default server config is selected", () => {
        it("should select other homeserver field on open", () => {
            getComponent();
            expect(getOtherHomeserverCheckBox()).toBeChecked();
            // empty field
            expect(getOtherHomeserverInput()).toHaveDisplayValue("");
        });

        it("should display an error when trying to continue with an empty homeserver field", async () => {
            const onFinished = jest.fn();
            const { container } = getComponent({ onFinished });

            fireEvent.click(screen.getByText("Continue"));

            await flushPromises();

            // error on field
            expect(container.querySelector(".mx_ServerPickerDialog_otherHomeserver.mx_Field_invalid")).toBeTruthy();

            // didn't close dialog
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("should close when selecting default homeserver and clicking continue", async () => {
            const onFinished = jest.fn();
            getComponent({ onFinished });

            fireEvent.click(screen.getByTestId("defaultHomeserver"));
            expect(screen.getByTestId("defaultHomeserver")).toBeChecked();

            fireEvent.click(screen.getByText("Continue"));

            // closed dialog with default server
            expect(onFinished).toHaveBeenCalledWith(defaultServerConfig);
        });

        it("should allow user to revert from a custom server to the default", async () => {
            fetchMock.get(`https://custom.org/_matrix/client/versions`, {
                unstable_features: {},
                versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
            });

            const onFinished = jest.fn();
            const serverConfig = {
                hsUrl: "https://custom.org",
                hsName: "custom.org",
                hsNameIsDifferent: true,
                isUrl: "https://is.org",
                isDefault: false,
                isNameResolvable: true,
                warning: "",
            };
            getComponent({ onFinished, serverConfig });

            fireEvent.click(screen.getByTestId("defaultHomeserver"));
            expect(screen.getByTestId("defaultHomeserver")).toBeChecked();

            fireEvent.click(screen.getByText("Continue"));
            await flushPromises();

            // closed dialog with default server and nothing else
            expect(onFinished).toHaveBeenCalledWith(defaultServerConfig);
            expect(onFinished).toHaveBeenCalledTimes(1);
        });

        it("should submit successfully with a valid custom homeserver", async () => {
            const homeserver = "https://myhomeserver.site";
            fetchMock.get(`${homeserver}/_matrix/client/versions`, {
                unstable_features: {},
                versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
            });
            const onFinished = jest.fn();
            getComponent({ onFinished });

            fireEvent.change(getOtherHomeserverInput(), { target: { value: homeserver } });
            expect(getOtherHomeserverInput()).toHaveDisplayValue(homeserver);

            fireEvent.click(screen.getByText("Continue"));

            // validation on submit is async
            await flushPromises();

            // closed dialog with validated custom server
            expect(onFinished).toHaveBeenCalledWith({
                hsName: "myhomeserver.site",
                hsUrl: homeserver,
                hsNameIsDifferent: false,
                warning: null,
                isDefault: false,
                isNameResolvable: false,
                isUrl: defaultServerConfig.isUrl,
            });
        });

        describe("validates custom homeserver", () => {
            it("should lookup .well-known for homeserver without protocol", async () => {
                const homeserver = "myhomeserver1.site";
                const wellKnownUrl = `https://${homeserver}/.well-known/matrix/client`;
                fetchMock.get(wellKnownUrl, {});
                getComponent();

                fireEvent.change(getOtherHomeserverInput(), { target: { value: homeserver } });
                expect(getOtherHomeserverInput()).toHaveDisplayValue(homeserver);
                // trigger validation
                fireEvent.blur(getOtherHomeserverInput());

                // validation on submit is async
                await flushPromises();

                expect(fetchMock).toHaveFetched(wellKnownUrl);
            });

            it("should submit using validated config from a valid .well-known", async () => {
                const homeserver = "myhomeserver2.site";
                const wellKnownUrl = `https://${homeserver}/.well-known/matrix/client`;

                // urls from homeserver well-known
                const versionsUrl = `${wkHsUrl}/_matrix/client/versions`;
                const isWellKnownUrl = `${wkIsUrl}/_matrix/identity/v2`;

                fetchMock.getOnce(wellKnownUrl, validWellKnown);
                fetchMock.getOnce(versionsUrl, {
                    versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
                });
                fetchMock.getOnce(isWellKnownUrl, {});
                const onFinished = jest.fn();
                getComponent({ onFinished });

                fireEvent.change(getOtherHomeserverInput(), { target: { value: homeserver } });
                fireEvent.click(screen.getByText("Continue"));

                // validation on submit is async
                await flushPromises();

                expect(fetchMock).toHaveFetched(wellKnownUrl);
                // fetched using urls from .well-known
                expect(fetchMock).toHaveFetched(versionsUrl);
                expect(fetchMock).toHaveFetched(isWellKnownUrl);

                expect(onFinished).toHaveBeenCalledWith({
                    hsName: homeserver,
                    hsUrl: wkHsUrl,
                    hsNameIsDifferent: true,
                    warning: null,
                    isDefault: false,
                    isNameResolvable: true,
                    isUrl: wkIsUrl,
                });

                await flushPromises();
            });

            it("should fall back to static config when well-known lookup fails", async () => {
                const homeserver = "myhomeserver3.site";
                // this server returns 404 for well-known
                const wellKnownUrl = `https://${homeserver}/.well-known/matrix/client`;
                fetchMock.get(wellKnownUrl, { status: 404 });
                // but is otherwise live (happy versions response)
                fetchMock.get(`https://${homeserver}/_matrix/client/versions`, {
                    versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
                });
                const onFinished = jest.fn();
                getComponent({ onFinished });

                fireEvent.change(getOtherHomeserverInput(), { target: { value: homeserver } });
                fireEvent.click(screen.getByText("Continue"));

                // validation on submit is async
                await flushPromises();

                expect(fetchMock).toHaveFetched(wellKnownUrl);
                expect(fetchMock).toHaveFetched(`https://${homeserver}/_matrix/client/versions`);

                expect(onFinished).toHaveBeenCalledWith({
                    hsName: homeserver,
                    hsUrl: "https://" + homeserver,
                    hsNameIsDifferent: false,
                    warning: null,
                    isDefault: false,
                    isNameResolvable: false,
                    isUrl: defaultServerConfig.isUrl,
                });
            });
        });
    });
});
