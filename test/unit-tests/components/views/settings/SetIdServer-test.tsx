/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock-jest";

import SetIdServer from "../../../../../src/components/views/settings/SetIdServer";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter, mockClientMethodsUser, mockClientMethodsServer } from "../../../../test-utils";

describe("<SetIdServer />", () => {
    const userId = "@alice:server.org";

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getOpenIdToken: jest.fn().mockResolvedValue("a_token"),
        getTerms: jest.fn(),
        setAccountData: jest.fn(),
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SetIdServer missingTerms={false} />
        </MatrixClientContext.Provider>
    );

    afterAll(() => {
        jest.resetAllMocks();
    });

    it("renders expected fields", () => {
        const { asFragment } = render(getComponent());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should allow setting an identity server", async () => {
        const { getByLabelText, getByRole } = render(getComponent());

        fetchMock.get("https://identity.example.org/_matrix/identity/v2", {
            body: {},
        });
        fetchMock.get("https://identity.example.org/_matrix/identity/v2/account", {
            body: { user_id: userId },
        });
        fetchMock.post("https://identity.example.org/_matrix/identity/v2/account/register", {
            body: { token: "foobar" },
        });

        const identServerField = getByLabelText("Enter a new identity server");
        await userEvent.type(identServerField, "https://identity.example.org");
        await userEvent.click(getByRole("button", { name: "Change" }));
        await userEvent.click(getByRole("button", { name: "Continue" }));
    });

    it("should clear input on cancel", async () => {
        const { getByLabelText, getByRole } = render(getComponent());
        const identServerField = getByLabelText("Enter a new identity server");
        await userEvent.type(identServerField, "https://identity.example.org");
        await userEvent.click(getByRole("button", { name: "Reset" }));
        expect((identServerField as HTMLInputElement).value).toEqual("");
    });

    it("should show error when an error occurs", async () => {
        const { getByLabelText, getByRole, getByText } = render(getComponent());

        fetchMock.get("https://invalid.example.org/_matrix/identity/v2", {
            body: {},
            status: 404,
        });
        fetchMock.get("https://invalid.example.org/_matrix/identity/v2/account", {
            body: {},
            status: 404,
        });
        fetchMock.post("https://invalid.example.org/_matrix/identity/v2/account/register", {
            body: {},
            status: 404,
        });

        const identServerField = getByLabelText("Enter a new identity server");
        await userEvent.type(identServerField, "https://invalid.example.org");
        await userEvent.click(getByRole("button", { name: "Change" }));

        await waitFor(
            () => {
                expect(getByText("Not a valid identity server (status code 404)")).toBeVisible();
            },
            { timeout: 3000 },
        );

        // Check the error vanishes when the input is edited.
        await userEvent.type(identServerField, "https://identity2.example.org");
        expect(() => getByText("Not a valid identity server (status code 404)")).toThrow();
    });
});
