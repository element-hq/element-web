/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

import Menu from "./Menu";
import { Theme } from "./theme";
import { type StaticConfig } from "./config";

const makeApi = (): Api => {
    return {
        i18n: {
            translate: vi.fn((key: string) => key),
        },
    } as unknown as Api;
};

const config: StaticConfig = {
    type: "static",
    categories: [
        {
            name: "Category",
            links: [{ icon_uri: "https://example.com/icon.png", name: "Link", link_url: "https://example.com/link" }],
        },
    ],
    logo_url: "https://example.com/logo.png",
    logo_height: 40,
    logo_href: "https://example.com/target",
};

describe("Menu", () => {
    it("opens the sidebar and renders categories, links, and a logo linked via logo_href", async () => {
        const user = userEvent.setup();
        render(
            <ThemeProvider theme={Theme.parse({})}>
                <Menu api={makeApi()} config={config} fallbackLogoUrl="https://example.com/fallback.png" />
            </ThemeProvider>,
        );

        await user.click(screen.getByRole("button", { name: "trigger_label" }));

        expect(screen.getByText("Category")).toBeInTheDocument();
        const link = await screen.findByRole("link", { name: "Link" });
        expect(link).toHaveAttribute("href", "https://example.com/link");

        const logoLink = screen.getByRole("link", { name: "logo_alt" });
        expect(logoLink).toHaveAttribute("href", "https://example.com/target");
    });

    it("renders the logo without a wrapping link when logo_href is not configured", async () => {
        const user = userEvent.setup();
        const configWithoutLogoHref: StaticConfig = { ...config, logo_href: undefined };
        render(
            <ThemeProvider theme={Theme.parse({})}>
                <Menu
                    api={makeApi()}
                    config={configWithoutLogoHref}
                    fallbackLogoUrl="https://example.com/fallback.png"
                />
            </ThemeProvider>,
        );

        await user.click(screen.getByRole("button", { name: "trigger_label" }));

        const logo = await screen.findByRole("img", { name: "logo_alt" });
        expect(logo.closest("a")).toBeNull();
        expect(screen.getAllByRole("link")).toHaveLength(1);
    });
});
