/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, RenderResult } from "@testing-library/react";

import { filterConsole, withClientContextRenderOptions, stubClient } from "../../../test-utils";
import { UserOnboardingPage } from "../../../../src/components/views/user-onboarding/UserOnboardingPage";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SdkConfig from "../../../../src/SdkConfig";

jest.mock("../../../../src/components/structures/EmbeddedPage", () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div>{url}</div>,
}));

jest.mock("../../../../src/components/structures/HomePage", () => ({
    __esModule: true,
    default: () => <div>home page</div>,
}));

describe("UserOnboardingPage", () => {
    const renderComponent = async (): Promise<RenderResult> => {
        const renderResult = render(<UserOnboardingPage />, withClientContextRenderOptions(MatrixClientPeg.safeGet()));
        await act(async () => {
            jest.runAllTimers();
        });
        return renderResult;
    };

    filterConsole(
        // unrelated for this test
        "could not update user onboarding context",
    );

    beforeEach(() => {
        stubClient();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe("when the user registered before the cutoff date", () => {
        beforeEach(() => {
            jest.spyOn(MatrixClientPeg, "userRegisteredAfter").mockReturnValue(false);
        });

        it("should render the home page", async () => {
            expect((await renderComponent()).queryByText("home page")).toBeInTheDocument();
        });
    });

    describe("when the user registered after the cutoff date", () => {
        beforeEach(() => {
            jest.spyOn(MatrixClientPeg, "userRegisteredAfter").mockReturnValue(true);
        });

        describe("and there is an explicit home page configured", () => {
            beforeEach(() => {
                jest.spyOn(SdkConfig, "get").mockReturnValue({
                    embedded_pages: {
                        home_url: "https://example.com/home",
                    },
                });
            });

            it("should render the configured page", async () => {
                expect((await renderComponent()).queryByText("https://example.com/home")).toBeInTheDocument();
            });
        });

        describe("and there is no home page configured", () => {
            it("should render the onboarding", async () => {
                expect((await renderComponent()).queryByTestId("user-onboarding-list")).toBeInTheDocument();
            });
        });
    });
});
