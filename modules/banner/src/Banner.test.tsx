/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { type Api } from "@element-hq/element-web-module-api";

import Banner from "./Banner";
import { Theme } from "./theme";
import { type StaticConfig } from "./config";

const makeApi = (): Api => {
    return {
        i18n: {
            translate: vi.fn((key: string) => key),
        },
    } as unknown as Api;
};

const menu: StaticConfig = {
    type: "static",
    categories: [],
};

describe("Banner", () => {
    it("renders the title without a link when no href is provided", () => {
        render(
            <ThemeProvider theme={Theme.parse({})}>
                <Banner api={makeApi()} logoUrl="https://example.com/logo.png" href="" menu={menu} title="My Portal" />
            </ThemeProvider>,
        );

        expect(screen.getByRole("heading", { name: "My Portal" })).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("wraps the logo and title in a link when href is provided", () => {
        render(
            <ThemeProvider theme={Theme.parse({})}>
                <Banner
                    api={makeApi()}
                    logoUrl="https://example.com/logo.png"
                    href="https://example.com"
                    menu={menu}
                    title="My Portal"
                />
            </ThemeProvider>,
        );

        const link = document.querySelector('a[href="https://example.com"]');
        expect(link).not.toBeNull();
        expect(within(link as HTMLElement).getByRole("heading", { name: "My Portal" })).toBeInTheDocument();
    });
});
