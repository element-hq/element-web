/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";

import Field from "../../../../../src/components/views/elements/Field";

describe("Field", () => {
    describe("Placeholder", () => {
        it("Should display a placeholder", async () => {
            // When
            const { rerender } = render(<Field value="" placeholder="my placeholder" />);

            // Then
            expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "my placeholder");

            // When
            rerender(<Field value="" placeholder="" />);

            // Then
            expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "");
        });

        it("Should display label as placeholder", async () => {
            // When
            render(<Field value="" label="my label" />);

            // Then
            expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "my label");
        });

        it("Should not display a placeholder", async () => {
            // When
            render(<Field value="" />);

            // Then
            expect(screen.getByRole("textbox")).not.toHaveAttribute("placeholder", "my placeholder");
        });
    });

    describe("Feedback", () => {
        it("Should mark the feedback as alert if invalid", async () => {
            render(
                <Field
                    value=""
                    validateOnFocus
                    onValidate={() => Promise.resolve({ valid: false, feedback: "Invalid" })}
                />,
            );

            // When invalid
            fireEvent.focus(screen.getByRole("textbox"));

            // Expect 'aria-live=assertive'
            await expect(screen.findByRole("tooltip")).resolves.toHaveAttribute("aria-live", "assertive");

            // Close the feedback is Escape is pressed
            fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });

        it("Should mark the feedback as status if valid", async () => {
            render(
                <Field
                    value=""
                    validateOnFocus
                    onValidate={() => Promise.resolve({ valid: true, feedback: "Valid" })}
                />,
            );

            // When valid
            fireEvent.focus(screen.getByRole("textbox"));

            // Expect 'aria-live=polite' role
            await expect(screen.findByRole("tooltip")).resolves.toHaveAttribute("aria-live", "polite");

            // Close the feedback is Escape is pressed
            fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });

        it("Should mark the feedback as tooltip if custom tooltip set", async () => {
            render(
                <Field
                    value=""
                    validateOnFocus
                    onValidate={() => Promise.resolve({ valid: true, feedback: "Valid" })}
                    tooltipContent="Tooltip"
                />,
            );

            // When valid or invalid and 'tooltipContent' set
            fireEvent.focus(screen.getByRole("textbox"));

            // Expect 'tooltip' role
            await expect(screen.findByRole("tooltip")).resolves.toBeInTheDocument();

            // Close the feedback is Escape is pressed
            fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
            expect(screen.queryByRole("tooltip")).toBeNull();
        });
    });
});
