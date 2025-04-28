/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, screen, waitFor, cleanup } from "jest-matrix-react";
import { type MatrixClient, MatrixError, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import React from "react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import { AddRemoveThreepids } from "../../../../../src/components/views/settings/AddRemoveThreepids";
import { clearAllModals, stubClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import Modal from "../../../../../src/Modal";
import InteractiveAuthDialog from "../../../../../src/components/views/dialogs/InteractiveAuthDialog.tsx";

const MOCK_IDENTITY_ACCESS_TOKEN = "mock_identity_access_token";
const mockGetAccessToken = jest.fn().mockResolvedValue(MOCK_IDENTITY_ACCESS_TOKEN);
jest.mock("../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

const EMAIL1 = {
    medium: ThreepidMedium.Email,
    address: "alice@nowhere.dummy",
};

const PHONE1 = {
    medium: ThreepidMedium.Phone,
    address: "447700900000",
};

const PHONE1_LOCALNUM = "07700900000";

describe("AddRemoveThreepids", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        clearAllModals();
        cleanup();
    });

    const clientProviderWrapper: React.FC = ({ children }: React.PropsWithChildren) => (
        <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
    );

    it("should handle no email addresses", async () => {
        const { container } = render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[]}
                isLoading={false}
                onChange={() => {}}
            />,
        );

        await expect(screen.findByText("Email Address")).resolves.toBeVisible();
        expect(container).toMatchSnapshot();
    });

    it("should add an email address", async () => {
        const onChangeFn = jest.fn();
        mocked(client.requestAdd3pidEmailToken).mockResolvedValue({ sid: "1" });

        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const input = await screen.findByRole("textbox", { name: "Email Address" });
        await userEvent.type(input, EMAIL1.address);
        const addButton = screen.getByRole("button", { name: "Add" });
        await userEvent.click(addButton);

        expect(client.requestAdd3pidEmailToken).toHaveBeenCalledWith(EMAIL1.address, client.generateClientSecret(), 1);
        const continueButton = screen.getByRole("button", { name: "Continue" });

        expect(continueButton).toBeEnabled();

        await userEvent.click(continueButton);

        expect(client.addThreePidOnly).toHaveBeenCalledWith({
            client_secret: client.generateClientSecret(),
            sid: "1",
            auth: undefined,
        });

        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should display an error if the link has not been clicked", async () => {
        const onChangeFn = jest.fn();
        const createDialogFn = jest.spyOn(Modal, "createDialog");
        mocked(client.requestAdd3pidEmailToken).mockResolvedValue({ sid: "1" });

        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const input = await screen.findByRole("textbox", { name: "Email Address" });
        await userEvent.type(input, EMAIL1.address);
        const addButton = screen.getByRole("button", { name: "Add" });
        await userEvent.click(addButton);

        const continueButton = screen.getByRole("button", { name: "Continue" });

        expect(continueButton).toBeEnabled();

        mocked(client).addThreePidOnly.mockRejectedValueOnce(new Error("Unauthorized"));

        await userEvent.click(continueButton);

        expect(createDialogFn).toHaveBeenCalledWith(expect.anything(), {
            description: "Unauthorized",
            title: "Unable to verify email address.",
        });

        expect(onChangeFn).not.toHaveBeenCalled();
    });

    it("should add a phone number", async () => {
        const onChangeFn = jest.fn();
        mocked(client.requestAdd3pidMsisdnToken).mockResolvedValue({
            sid: "1",
            msisdn: PHONE1.address,
            intl_fmt: "+" + PHONE1.address,
            success: true,
            submit_url: "https://example.dummy",
        });

        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Phone}
                threepids={[]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const countryDropdown = await screen.findByRole("button", { name: /Country Dropdown/ });
        await userEvent.click(countryDropdown);
        const gbOption = screen.getByText("United Kingdom (+44)");
        await userEvent.click(gbOption);

        const input = screen.getByRole("textbox", { name: "Phone Number" });
        await userEvent.type(input, PHONE1_LOCALNUM);

        const addButton = screen.getByRole("button", { name: /Add/ });
        userEvent.click(addButton);

        const continueButton = await screen.findByRole("button", { name: /Continue/ });

        expect(continueButton).toHaveAttribute("aria-disabled", "true");

        await expect(
            screen.findByText(
                `A text message has been sent to +${PHONE1.address}. Please enter the verification code it contains.`,
            ),
        ).resolves.toBeInTheDocument();

        expect(client.requestAdd3pidMsisdnToken).toHaveBeenCalledWith(
            "GB",
            PHONE1_LOCALNUM,
            client.generateClientSecret(),
            1,
        );

        const verificationInput = screen.getByRole("textbox", { name: "Verification code" });
        await userEvent.type(verificationInput, "123456");

        expect(continueButton).not.toHaveAttribute("aria-disabled", "true");
        userEvent.click(continueButton);

        await waitFor(() => expect(continueButton).toHaveAttribute("aria-disabled", "true"));

        expect(client.addThreePidOnly).toHaveBeenCalledWith({
            client_secret: client.generateClientSecret(),
            sid: "1",
            auth: undefined,
        });

        expect(onChangeFn).toHaveBeenCalled();
    }, 10000);

    it("should remove an email address", async () => {
        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[EMAIL1]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const removeButton = await screen.findByRole("button", { name: /Remove/ });
        await userEvent.click(removeButton);

        expect(screen.getByText(`Remove ${EMAIL1.address}?`)).toBeVisible();

        const confirmRemoveButton = screen.getByRole("button", { name: /Remove/ });
        await userEvent.click(confirmRemoveButton);

        expect(client.deleteThreePid).toHaveBeenCalledWith(ThreepidMedium.Email, EMAIL1.address);
        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should return to default view if adding is cancelled", async () => {
        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[EMAIL1]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const removeButton = await screen.findByRole("button", { name: /Remove/ });
        await userEvent.click(removeButton);

        expect(screen.getByText(`Remove ${EMAIL1.address}?`)).toBeVisible();

        const confirmRemoveButton = screen.getByRole("button", { name: /Cancel/ });
        await userEvent.click(confirmRemoveButton);

        expect(screen.queryByText(`Remove ${EMAIL1.address}?`)).not.toBeInTheDocument();

        expect(client.deleteThreePid).not.toHaveBeenCalledWith(ThreepidMedium.Email, EMAIL1.address);
        expect(onChangeFn).not.toHaveBeenCalled();
    });

    it("should remove a phone number", async () => {
        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Phone}
                threepids={[PHONE1]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const removeButton = await screen.findByRole("button", { name: /Remove/ });
        await userEvent.click(removeButton);

        expect(screen.getByText(`Remove ${PHONE1.address}?`)).toBeVisible();

        const confirmRemoveButton = screen.getByRole("button", { name: /Remove/ });
        await userEvent.click(confirmRemoveButton);

        expect(client.deleteThreePid).toHaveBeenCalledWith(ThreepidMedium.Phone, PHONE1.address);
        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should bind an email address", async () => {
        mocked(client).requestEmailToken.mockResolvedValue({ sid: "1" });

        mocked(client).getIdentityServerUrl.mockReturnValue("https://the_best_id_server.dummy");

        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="is"
                medium={ThreepidMedium.Email}
                threepids={[Object.assign({}, EMAIL1, { bound: false })]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        await expect(screen.findByText(EMAIL1.address)).resolves.toBeVisible();
        const shareButton = screen.getByRole("button", { name: /Share/ });
        await userEvent.click(shareButton);

        expect(screen.getByText("Verify the link in your inbox")).toBeVisible();

        expect(client.requestEmailToken).toHaveBeenCalledWith(
            EMAIL1.address,
            client.generateClientSecret(),
            1,
            undefined,
            MOCK_IDENTITY_ACCESS_TOKEN,
        );

        const completeButton = screen.getByRole("button", { name: /Complete/ });
        await userEvent.click(completeButton);

        expect(client.bindThreePid).toHaveBeenCalledWith({
            sid: "1",
            client_secret: client.generateClientSecret(),
            id_server: "https://the_best_id_server.dummy",
            id_access_token: MOCK_IDENTITY_ACCESS_TOKEN,
        });

        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should bind a phone number", async () => {
        mocked(client).requestMsisdnToken.mockResolvedValue({
            success: true,
            sid: "1",
            msisdn: PHONE1.address,
            intl_fmt: "+" + PHONE1.address,
        });

        mocked(client).getIdentityServerUrl.mockReturnValue("https://the_best_id_server.dummy");

        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="is"
                medium={ThreepidMedium.Phone}
                threepids={[Object.assign({}, PHONE1, { bound: false })]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        await expect(screen.findByText(PHONE1.address)).resolves.toBeVisible();
        const shareButton = screen.getByRole("button", { name: /Share/ });
        await userEvent.click(shareButton);

        expect(screen.getByText("Please enter verification code sent via text.")).toBeVisible();

        expect(client.requestMsisdnToken).toHaveBeenCalledWith(
            null,
            "+" + PHONE1.address,
            client.generateClientSecret(),
            1,
            undefined,
            MOCK_IDENTITY_ACCESS_TOKEN,
        );

        const codeInput = screen.getByRole("textbox", { name: "Verification code" });
        await userEvent.type(codeInput, "123456");
        await userEvent.keyboard("{Enter}");

        expect(client.bindThreePid).toHaveBeenCalledWith({
            sid: "1",
            client_secret: client.generateClientSecret(),
            id_server: "https://the_best_id_server.dummy",
            id_access_token: MOCK_IDENTITY_ACCESS_TOKEN,
        });

        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should revoke a bound email address", async () => {
        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="is"
                medium={ThreepidMedium.Email}
                threepids={[Object.assign({}, EMAIL1, { bound: true })]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        await expect(screen.findByText(EMAIL1.address)).resolves.toBeVisible();
        const revokeButton = screen.getByRole("button", { name: /Revoke/ });
        await userEvent.click(revokeButton);

        expect(client.unbindThreePid).toHaveBeenCalledWith(ThreepidMedium.Email, EMAIL1.address);
        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should revoke a bound phone number", async () => {
        const onChangeFn = jest.fn();
        render(
            <AddRemoveThreepids
                mode="is"
                medium={ThreepidMedium.Phone}
                threepids={[Object.assign({}, PHONE1, { bound: true })]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        await expect(screen.findByText(PHONE1.address)).resolves.toBeVisible();
        const revokeButton = screen.getByRole("button", { name: /Revoke/ });
        await userEvent.click(revokeButton);

        expect(client.unbindThreePid).toHaveBeenCalledWith(ThreepidMedium.Phone, PHONE1.address);
        expect(onChangeFn).toHaveBeenCalled();
    });

    it("should show UIA dialog when necessary for adding email", async () => {
        const onChangeFn = jest.fn();
        const createDialogFn = jest.spyOn(Modal, "createDialog");
        mocked(client.requestAdd3pidEmailToken).mockResolvedValue({ sid: "1" });

        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const input = screen.getByRole("textbox", { name: "Email Address" });
        await userEvent.type(input, EMAIL1.address);
        const addButton = screen.getByRole("button", { name: "Add" });
        await userEvent.click(addButton);

        const continueButton = screen.getByRole("button", { name: "Continue" });

        expect(continueButton).toBeEnabled();

        mocked(client).addThreePidOnly.mockRejectedValueOnce(
            new MatrixError({ errcode: "M_UNAUTHORIZED", flows: [{ stages: [] }] }, 401),
        );

        await userEvent.click(continueButton);

        expect(createDialogFn).toHaveBeenCalledWith(
            InteractiveAuthDialog,
            expect.objectContaining({
                title: "Add Email Address",
                makeRequest: expect.any(Function),
            }),
        );
    });

    it("should show UIA dialog when necessary for adding msisdn", async () => {
        const onChangeFn = jest.fn();
        const createDialogFn = jest.spyOn(Modal, "createDialog");
        mocked(client.requestAdd3pidMsisdnToken).mockResolvedValue({
            sid: "1",
            msisdn: PHONE1.address,
            intl_fmt: PHONE1.address,
            success: true,
            submit_url: "https://some-url",
        });

        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Phone}
                threepids={[]}
                isLoading={false}
                onChange={onChangeFn}
            />,
            {
                wrapper: clientProviderWrapper,
            },
        );

        const countryDropdown = screen.getByRole("button", { name: /Country Dropdown/ });
        await userEvent.click(countryDropdown);
        const gbOption = screen.getByText("United Kingdom (+44)");
        await userEvent.click(gbOption);

        const input = screen.getByRole("textbox", { name: "Phone Number" });
        await userEvent.type(input, PHONE1_LOCALNUM);

        const addButton = screen.getByRole("button", { name: "Add" });
        await userEvent.click(addButton);

        const continueButton = screen.getByRole("button", { name: "Continue" });

        expect(continueButton).toHaveAttribute("aria-disabled", "true");

        await expect(
            screen.findByText(
                `A text message has been sent to +${PHONE1.address}. Please enter the verification code it contains.`,
            ),
        ).resolves.toBeInTheDocument();

        expect(client.requestAdd3pidMsisdnToken).toHaveBeenCalledWith(
            "GB",
            PHONE1_LOCALNUM,
            client.generateClientSecret(),
            1,
        );

        const verificationInput = screen.getByRole("textbox", { name: "Verification code" });
        await userEvent.type(verificationInput, "123456");

        expect(continueButton).not.toHaveAttribute("aria-disabled", "true");

        mocked(client).addThreePidOnly.mockRejectedValueOnce(
            new MatrixError({ errcode: "M_UNAUTHORIZED", flows: [{ stages: [] }] }, 401),
        );

        await userEvent.click(continueButton);

        expect(createDialogFn).toHaveBeenCalledWith(
            InteractiveAuthDialog,
            expect.objectContaining({
                title: "Add Phone Number",
                makeRequest: expect.any(Function),
            }),
        );
    });

    it("should render a loader while loading", async () => {
        render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[]}
                isLoading={true}
                onChange={() => {}}
            />,
        );

        expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    });

    it("should render email addresses", async () => {
        const { container } = render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Email}
                threepids={[EMAIL1]}
                isLoading={false}
                onChange={() => {}}
            />,
        );

        await expect(screen.findByText(EMAIL1.address)).resolves.toBeVisible();
        expect(container).toMatchSnapshot();
    });

    it("should render phone numbers", async () => {
        const { container } = render(
            <AddRemoveThreepids
                mode="hs"
                medium={ThreepidMedium.Phone}
                threepids={[PHONE1]}
                isLoading={false}
                onChange={() => {}}
            />,
        );

        await expect(screen.findByText(PHONE1.address)).resolves.toBeVisible();
        expect(container).toMatchSnapshot();
    });
});
