/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { ChangeRecoveryKey } from "./ChangeRecoveryKey";

// The flows themselves are covered by ChangeRecoveryKeyBody.test.tsx
describe("<ChangeRecoveryKey />", () => {
    it("should cancel when the breadcrumb back button is clicked", async () => {
        const user = userEvent.setup();
        const onCancelClick = vi.fn();
        render(
            <ChangeRecoveryKey userHasRecoveryKey={true} onFinish={vi.fn()} onCancelClick={onCancelClick} />,
            withClientContextRenderOptions(createTestClient()),
        );

        await user.click(screen.getByRole("button", { name: "Back" }));
        expect(onCancelClick).toHaveBeenCalled();
    });
});
