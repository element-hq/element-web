/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "test-utils-rtl";

import PowerSelector from "./PowerSelector";

describe("<PowerSelector />", () => {
    it("should reset back to custom value when custom input is blurred blank", async () => {
        const fn = vi.fn();
        render(<PowerSelector value={25} maxValue={100} usersDefault={0} onChange={fn} />);

        const input = screen.getByLabelText("Power level");
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);

        await screen.findByDisplayValue(25);
        expect(fn).not.toHaveBeenCalled();
    });

    it("should reset back to preset value when custom input is blurred blank", async () => {
        const fn = vi.fn();
        render(<PowerSelector value={50} maxValue={100} usersDefault={0} onChange={fn} />);

        const select = screen.getByLabelText("Power level");
        fireEvent.change(select, { target: { value: "SELECT_VALUE_CUSTOM" } });

        const input = screen.getByLabelText("Power level");
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);

        const option = await screen.findByText<HTMLOptionElement>("Moderator");
        expect(option.selected).toBeTruthy();
        expect(fn).not.toHaveBeenCalled();
    });

    it("should call onChange when custom input is blurred with a number in it", async () => {
        const fn = vi.fn();
        render(<PowerSelector value={25} maxValue={100} usersDefault={0} onChange={fn} powerLevelKey="key" />);

        const input = screen.getByLabelText("Power level");
        fireEvent.change(input, { target: { value: 40 } });
        fireEvent.blur(input);

        await screen.findByDisplayValue(40);
        expect(fn).toHaveBeenCalledWith(40, "key");
    });

    it("should reset when props get changed", async () => {
        const fn = vi.fn();
        const { rerender } = render(<PowerSelector value={50} maxValue={100} usersDefault={0} onChange={fn} />);

        const select = screen.getByLabelText("Power level");
        fireEvent.change(select, { target: { value: "SELECT_VALUE_CUSTOM" } });

        rerender(<PowerSelector value={51} maxValue={100} usersDefault={0} onChange={fn} />);
        await screen.findByDisplayValue(51);

        rerender(<PowerSelector value={50} maxValue={100} usersDefault={0} onChange={fn} />);
        const option = await screen.findByText<HTMLOptionElement>("Moderator");
        expect(option.selected).toBeTruthy();
        expect(fn).not.toHaveBeenCalled();
    });

    it("should reset when onChange promise rejects", async () => {
        const deferred = Promise.withResolvers<void>();
        render(
            <PowerSelector
                value={25}
                maxValue={100}
                usersDefault={0}
                onChange={() => deferred.promise}
                powerLevelKey="key"
            />,
        );

        const input = screen.getByLabelText("Power level");
        fireEvent.change(input, { target: { value: 40 } });
        fireEvent.blur(input);

        await expect(screen.findByDisplayValue(40)).resolves.toBeVisible();
        deferred.reject("Some error");
        await expect(screen.findByDisplayValue(25)).resolves.toBeVisible();
    });
});
