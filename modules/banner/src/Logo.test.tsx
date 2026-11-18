/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type I18nApi } from "@element-hq/element-web-module-api";

import Logo from "./Logo";

const makeI18n = (): I18nApi => {
    return {
        translate: vi.fn((key: string) => key),
    } as unknown as I18nApi;
};

describe("Logo", () => {
    it("renders an image with the translated alt text", () => {
        render(<Logo i18n={makeI18n()} src="https://example.com/logo.png" height="40px" />);

        const img = screen.getByRole("img", { name: "logo_alt" });
        expect(img).toHaveAttribute("src", "https://example.com/logo.png");
    });
});
