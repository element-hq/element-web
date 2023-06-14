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

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/@types/threepids";
import { IRequestTokenResponse } from "matrix-js-sdk/src/client";
import { MatrixError } from "matrix-js-sdk/src/http-api";

import { UserFriendlyError } from "../../../../../src/languageHandler";
import EmailAddresses, { EmailAddress } from "../../../../../src/components/views/settings/discovery/EmailAddresses";
import { clearAllModals, getMockClientWithEventEmitter } from "../../../../test-utils";

const mockGetAccessToken = jest.fn().mockResolvedValue("getAccessToken");
jest.mock("../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

const emailThreepidFixture: IThreepid = {
    medium: ThreepidMedium.Email,
    address: "foo@bar.com",
    validated_at: 12345,
    added_at: 12342,
    bound: false,
};

describe("<EmailAddress/>", () => {
    const mockClient = getMockClientWithEventEmitter({
        getIdentityServerUrl: jest.fn().mockReturnValue("https://fake-identity-server"),
        generateClientSecret: jest.fn(),
        doesServerSupportSeparateAddAndBind: jest.fn(),
        requestEmailToken: jest.fn(),
        bindThreePid: jest.fn(),
    });

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        jest.useRealTimers();
        await clearAllModals();
    });

    it("should track props.email.bound changes", async () => {
        const { rerender } = render(<EmailAddress email={emailThreepidFixture} />);
        await screen.findByText("Share");

        rerender(
            <EmailAddress
                email={{
                    ...emailThreepidFixture,
                    bound: true,
                }}
            />,
        );
        await screen.findByText("Revoke");
    });

    describe("Email verification share phase", () => {
        it("shows translated error message", async () => {
            render(<EmailAddress email={emailThreepidFixture} />);
            mockClient.doesServerSupportSeparateAddAndBind.mockResolvedValue(true);
            mockClient.requestEmailToken.mockRejectedValue(
                new MatrixError(
                    { errcode: "M_THREEPID_IN_USE", error: "Some fake MatrixError occured" },
                    400,
                    "https://fake-url/",
                ),
            );
            fireEvent.click(screen.getByText("Share"));

            // Expect error dialog/modal to be shown. We have to wait for the UI to transition.
            expect(await screen.findByText("This email address is already in use")).toBeInTheDocument();
        });
    });

    describe("Email verification complete phase", () => {
        beforeEach(async () => {
            // Start these tests out at the "Complete" phase
            render(<EmailAddress email={emailThreepidFixture} />);
            mockClient.requestEmailToken.mockResolvedValue({ sid: "123-fake-sid" } satisfies IRequestTokenResponse);
            mockClient.doesServerSupportSeparateAddAndBind.mockResolvedValue(true);
            fireEvent.click(screen.getByText("Share"));
            // Then wait for the completion screen to come up
            await screen.findByText("Complete");
        });

        it("Shows error dialog when share completion fails (email not verified yet)", async () => {
            mockClient.bindThreePid.mockRejectedValue(
                new MatrixError(
                    { errcode: "M_THREEPID_AUTH_FAILED", error: "Some fake MatrixError occured" },
                    403,
                    "https://fake-url/",
                ),
            );
            fireEvent.click(screen.getByText("Complete"));

            // Expect error dialog/modal to be shown. We have to wait for the UI to transition.
            // Check the title
            expect(await screen.findByText("Your email address hasn't been verified yet")).toBeInTheDocument();
            // Check the description
            expect(
                await screen.findByText(
                    "Click the link in the email you received to verify and then click continue again.",
                ),
            ).toBeInTheDocument();
        });

        it("Shows error dialog when share completion fails (UserFriendlyError)", async () => {
            const fakeErrorText = "Fake UserFriendlyError error in test";
            mockClient.bindThreePid.mockRejectedValue(new UserFriendlyError(fakeErrorText));
            fireEvent.click(screen.getByText("Complete"));

            // Expect error dialog/modal to be shown. We have to wait for the UI to transition.
            // Check the title
            expect(await screen.findByText("Unable to verify email address.")).toBeInTheDocument();
            // Check the description
            expect(await screen.findByText(fakeErrorText)).toBeInTheDocument();
        });

        it("Shows error dialog when share completion fails (generic error)", async () => {
            const fakeErrorText = "Fake plain error in test";
            mockClient.bindThreePid.mockRejectedValue(new Error(fakeErrorText));
            fireEvent.click(screen.getByText("Complete"));

            // Expect error dialog/modal to be shown. We have to wait for the UI to transition.
            // Check the title
            expect(await screen.findByText("Unable to verify email address.")).toBeInTheDocument();
            // Check the description
            expect(await screen.findByText(fakeErrorText)).toBeInTheDocument();
        });
    });
});

describe("<EmailAddresses />", () => {
    it("should render a loader while loading", async () => {
        const { container } = render(<EmailAddresses emails={[emailThreepidFixture]} isLoading={true} />);

        expect(container).toMatchSnapshot();
    });

    it("should render email addresses", async () => {
        const { container } = render(<EmailAddresses emails={[emailThreepidFixture]} isLoading={false} />);

        expect(container).toMatchSnapshot();
    });

    it("should handle no email addresses", async () => {
        const { container } = render(<EmailAddresses emails={[]} isLoading={false} />);

        expect(container).toMatchSnapshot();
    });
});
