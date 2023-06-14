/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import fetchMock from "fetch-mock-jest";

import ServerPickerDialog from "../../../../src/components/views/dialogs/ServerPickerDialog";
import SdkConfig from "../../../../src/SdkConfig";
import { flushPromises } from "../../../test-utils";
import { ValidatedServerConfig } from "../../../../src/utils/ValidatedServerConfig";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

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

        it("should submit successfully with a valid custom homeserver", async () => {
            const homeserver = "https://myhomeserver.site";
            fetchMock.get(`${homeserver}/_matrix/client/versions`, {
                unstable_features: {},
                versions: [],
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
                    versions: [],
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
                fetchMock.get(`https://${homeserver}/_matrix/client/versions`, { versions: ["1"] });
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
