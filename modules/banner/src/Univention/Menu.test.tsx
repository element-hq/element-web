/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fetchMock from "@fetch-mock/vitest";
import { ThemeProvider } from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

import Menu from "./Menu";
import { Theme } from "../theme";
import { type UniventionConfig } from "../config";

// The silent login iframe would try to load the ICS, stub it out
vi.mock("./SilentLogin", () => ({ default: () => null }));

const makeApi = (): Api => {
    return {
        i18n: {
            language: "en-GB",
            translate: vi.fn((key: string) => key),
        },
    } as unknown as Api;
};

const config: UniventionConfig = {
    type: "univention",
    ics_url: "https://ics.example.com/ics/",
    logo_url: "https://example.com/logo.png",
    logo_href: "https://example.com/target",
};

// Response from the ICS navigation.json endpoint
const navigation = {
    categories: [
        {
            identifier: "category",
            display_name: "Category",
            entries: [
                {
                    identifier: "link",
                    icon_url: "https://example.com/icon.svg",
                    display_name: "Link",
                    link: "https://example.com/link",
                    target: "_blank",
                },
            ],
        },
    ],
};

const renderMenu = (props: Partial<UniventionConfig> = {}): void => {
    render(
        <ThemeProvider theme={Theme.parse({})}>
            <Menu api={makeApi()} config={{ ...config, ...props }} fallbackLogoUrl="https://example.com/fallback.png" />
        </ThemeProvider>,
    );
};

describe("Univention Menu", () => {
    const navigationUrl = "https://ics.example.com/ics/navigation.json?language=en";

    beforeEach(() => {
        fetchMock.mockGlobal();
        fetchMock.catch(404);
    });

    afterEach(() => {
        fetchMock.hardReset();
    });

    it("renders the navigation from the ICS and a logo linked via logo_href", async () => {
        fetchMock.get(navigationUrl, navigation);
        const user = userEvent.setup();
        renderMenu();

        await user.click(screen.getByRole("button", { name: "trigger_label" }));

        const link = await screen.findByRole("link", { name: "Link" });
        expect(link).toHaveAttribute("href", "https://example.com/link");
        expect(screen.getByText("Category")).toBeInTheDocument();
        expect(fetchMock).toHaveFetched(navigationUrl);
        expect(fetchMock.callHistory.lastCall(navigationUrl)?.options.credentials).toBe("include");

        const logoLink = screen.getByRole("link", { name: "logo_alt" });
        expect(logoLink).toHaveAttribute("href", "https://example.com/target");
    });

    it("links the logo via logo_href even if the ICS navigation fails to load", async () => {
        fetchMock.get(navigationUrl, 500);
        const user = userEvent.setup();
        renderMenu();

        await user.click(screen.getByRole("button", { name: "trigger_label" }));

        await expect(screen.findByText("univention_error")).resolves.toBeInTheDocument();
        const logoLink = screen.getByRole("link", { name: "logo_alt" });
        expect(logoLink).toHaveAttribute("href", "https://example.com/target");
    });

    it("renders the logo without a wrapping link when logo_href is not configured", async () => {
        fetchMock.get(navigationUrl, navigation);
        const user = userEvent.setup();
        renderMenu({ logo_href: undefined });

        await user.click(screen.getByRole("button", { name: "trigger_label" }));

        await screen.findByRole("link", { name: "Link" });
        const logo = screen.getByRole("img", { name: "logo_alt" });
        expect(logo.closest("a")).toBeNull();
    });
});
