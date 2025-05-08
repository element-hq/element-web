/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen } from "jest-matrix-react";
import { type MatrixClient, MatrixEvent, type Terms, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import { DiscoverySettings } from "../../../../../../src/components/views/settings/discovery/DiscoverySettings";
import { stubClient } from "../../../../../test-utils";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { UIFeature } from "../../../../../../src/settings/UIFeature";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";

const mockGetAccessToken = jest.fn().mockResolvedValue("$$getAccessToken");
jest.mock("../../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

const sampleTerms = {
    policies: {
        terms: { version: "alpha", en: { name: "No ball games", url: "https://foobar" } },
    },
} satisfies Terms;

const invalidTerms = {
    policies: {
        terms: { version: "invalid" },
    },
} satisfies Terms;

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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((key: any): any => {
            if (key === UIFeature.ThirdPartyID) return false;
        });

        const { container } = render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        expect(container).toBeEmptyDOMElement();
    });

    it("displays alert if an identity server needs terms accepting", async () => {
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue(sampleTerms);

        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        expect(await screen.findByText("Let people find you")).toBeInTheDocument();
        expect(screen.getByRole("link")).toHaveAttribute("href", "https://foobar");
    });

    it("button to accept terms is disabled if checkbox not checked", async () => {
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue(sampleTerms);

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

    it("should not disable share button if terms accepted", async () => {
        mocked(client).getThreePids.mockResolvedValue({
            threepids: [
                {
                    medium: ThreepidMedium.Email,
                    address: "test@email.com",
                    bound: false,
                    added_at: 123,
                    validated_at: 234,
                },
            ],
        });
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue(sampleTerms);
        mocked(client).getAccountData.mockReturnValue(
            new MatrixEvent({
                content: { accepted: [sampleTerms.policies["terms"]["en"].url] },
            }),
        );

        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        const shareButton = await screen.findByRole("button", { name: "Share" });
        expect(shareButton).not.toHaveAttribute("aria-disabled", "true");
    });

    it("should not show invalid terms", async () => {
        mocked(client).getIdentityServerUrl.mockReturnValue("https://example.com");
        mocked(client).getTerms.mockResolvedValue(invalidTerms);

        render(<DiscoverySettings />, { wrapper: DiscoveryWrapper });

        expect(await screen.findByText("Let people find you")).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
