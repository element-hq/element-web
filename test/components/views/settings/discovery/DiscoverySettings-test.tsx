/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
import { act, render, screen } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import DiscoverySettings from "../../../../../src/components/views/settings/discovery/DiscoverySettings";
import { stubClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";

const mockGetAccessToken = jest.fn().mockResolvedValue("$$getAccessToken");
jest.mock("../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

describe("DiscoverySettings", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const DiscoveryWrapper = (props = {}) => <MatrixClientContext.Provider value={client} {...props} />;

    it("is empty if 3pid features are disabled", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((key) => {
            if (key === UIFeature.ThirdPartyID) return false;
        });

        const { container } = render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        expect(container).toBeEmptyDOMElement();
    });

    it("displays alert if an identity server needs terms accepting", async () => {
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue({
            ["policies"]: { en: "No ball games" },
        });

        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        await expect(await screen.findByText("Let people find you")).toBeInTheDocument();
    });

    it("button to accept terms is disabled if checkbox not checked", async () => {
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue({
            ["policies"]: { en: "No ball games" },
        });

        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        const acceptCheckbox = await screen.findByRole("checkbox", { name: "Accept" });
        const continueButton = screen.getByRole("button", { name: "Continue" });
        expect(acceptCheckbox).toBeInTheDocument();
        expect(continueButton).toHaveAttribute("aria-disabled", "true");

        await userEvent.click(acceptCheckbox);
        expect(continueButton).not.toHaveAttribute("aria-disabled", "true");
    });

    it("updates if ID server is changed", async () => {
        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        mocked(client).getThreePids.mockClear();

        act(() => {
            defaultDispatcher.dispatch(
                {
                    action: "id_server_changed",
                },
                true,
            );
        });

        expect(client.getThreePids).toHaveBeenCalled();
    });
});
