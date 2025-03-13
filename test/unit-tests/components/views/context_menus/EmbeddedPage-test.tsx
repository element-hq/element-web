/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import fetchMock from "fetch-mock-jest";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { _t } from "../../../../../src/languageHandler";
import EmbeddedPage from "../../../../../src/components/structures/EmbeddedPage";

jest.mock("../../../../../src/languageHandler", () => ({
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
        expect(_t).toHaveBeenCalledWith("cant_load_page");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render nothing if no url given", () => {
        const { asFragment } = render(<EmbeddedPage />);
        expect(asFragment()).toMatchSnapshot();
    });
});
