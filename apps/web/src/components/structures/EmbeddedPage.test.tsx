/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import fetchMock from "@fetch-mock/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "test-utils-rtl";

import { _t } from "../../languageHandler";
import EmbeddedPage from "./EmbeddedPage";

vi.mock("../../languageHandler", async () => ({
    ...(await vi.importActual("../../languageHandler")),
    _t: vi.fn(),
}));

describe("<EmbeddedPage />", () => {
    it.each([`"`, `'`, `&#27;`, `&#34;`])("should translate _t strings [%s]", async (character) => {
        vi.mocked(_t).mockReturnValue("Przeglądaj pokoje");
        fetchMock.get("https://home.page", {
            body: `<h1>_t(${character}Explore rooms${character})</h1>`,
        });

        const { asFragment } = render(<EmbeddedPage url="https://home.page" />);
        await screen.findByText("Przeglądaj pokoje");
        expect(_t).toHaveBeenCalledWith("Explore rooms");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show error if unable to load", async () => {
        vi.mocked(_t).mockReturnValue("Couldn't load page");
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

    it("should sanitise input", async () => {
        fetchMock.get("https://other.page", `<h1>Foo</h1><iframe src="https://home.page" />`);

        const { asFragment } = render(<EmbeddedPage url="https://other.page" />);
        await expect(screen.findByText("Foo")).resolves.toBeVisible();
        expect(screen.queryByRole("iframe")).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should leave in-app anchor links untouched", async () => {
        fetchMock.get("/home.html", `<a href="#/register">Sign up</a>`);

        render(<EmbeddedPage url="/home.html" />);
        const link = await screen.findByText("Sign up");
        expect(link).toHaveAttribute("href", "#/register");
        expect(link).not.toHaveAttribute("target");
        expect(link).not.toHaveAttribute("rel");
    });

    it("should add target=_blank and rel to non-anchor links", async () => {
        fetchMock.get("/home.html", `<a href="https://example.com">Example</a>`);

        render(<EmbeddedPage url="/home.html" />);
        const link = await screen.findByText("Example");
        expect(link).toHaveAttribute("href", "https://example.com");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer noopener");
    });
});
