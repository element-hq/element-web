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
import { act, render, RenderResult } from "@testing-library/react";

import { filterConsole, stubClient } from "../../../test-utils";
import { UserOnboardingPage } from "../../../../src/components/views/user-onboarding/UserOnboardingPage";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SdkConfig from "../../../../src/SdkConfig";

jest.mock("../../../../src/components/structures/EmbeddedPage", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ url }) => <div>{url}</div>),
}));

jest.mock("../../../../src/components/structures/HomePage", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div>home page</div>),
}));

describe("UserOnboardingPage", () => {
    const renderComponent = async (): Promise<RenderResult> => {
        const renderResult = render(<UserOnboardingPage />);
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
