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
import fetchMock from "fetch-mock-jest";
import { render, screen } from "@testing-library/react";
import { mocked } from "jest-mock";

import { _t } from "../../../../src/languageHandler";
import EmbeddedPage from "../../../../src/components/structures/EmbeddedPage";

jest.mock("../../../../src/languageHandler", () => ({
    _t: jest.fn(),
}));

describe("<EmbeddedPage />", () => {
    it("should translate _t strings", async () => {
        mocked(_t).mockReturnValue("Przeglądaj pokoje");
        fetchMock.get("https://home.page", {
            body: '<h1>_t("Explore rooms")</h1>',
        });

        const { asFragment } = render(<EmbeddedPage url="https://home.page" />);
        await screen.findByText("Przeglądaj pokoje");
        expect(_t).toHaveBeenCalledWith("Explore rooms");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show error if unable to load", async () => {
        mocked(_t).mockReturnValue("Couldn't load page");
        fetchMock.get("https://other.page", {
            status: 404,
        });

        const { asFragment } = render(<EmbeddedPage url="https://other.page" />);
        await screen.findByText("Couldn't load page");
        expect(_t).toHaveBeenCalledWith("Couldn't load page");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render nothing if no url given", () => {
        const { asFragment } = render(<EmbeddedPage />);
        expect(asFragment()).toMatchSnapshot();
    });
});
