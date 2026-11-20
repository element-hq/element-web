/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nContext } from "@element-hq/web-shared-components";

import { EmailPill } from "./EmailPill";
import { mockApi } from "../../tests/mockApi";

describe("EmailPill", () => {
    it.each([
        { text: "alice@example.com", isValid: true },
        { text: "not-an-email", isValid: false },
    ])("renders and removes the email when isValid=$isValid", async (email) => {
        const onClick = vi.fn();
        const { container } = render(
            <I18nContext.Provider value={mockApi.i18n}>
                <EmailPill email={email} onClick={onClick} />
            </I18nContext.Provider>,
        );
        expect(container).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalled();
    });
});
