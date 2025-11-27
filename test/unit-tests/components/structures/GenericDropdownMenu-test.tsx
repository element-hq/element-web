/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";

import {
    GenericDropdownMenu,
    type GenericDropdownMenuItem,
} from "../../../../src/components/structures/GenericDropdownMenu.tsx";

describe("GenericDropdownMenu", () => {
    it("should render check icon for checked option", async () => {
        const options: GenericDropdownMenuItem<string>[] = [
            {
                key: "selected",
                label: "Selected",
                description: "This item is selected",
            },
            {
                key: "not-selected",
                label: "Not selected",
            },
        ];

        render(
            <GenericDropdownMenu
                value="selected"
                options={options}
                onChange={jest.fn()}
                selectedLabel={() => "Selected"}
            />,
        );

        const trigger = screen.getByRole("button");
        fireEvent.click(trigger);

        const dropdown = await screen.findByRole("menu");
        expect(
            dropdown.querySelector('[aria-checked="true"]')?.querySelector(".mx_GenericDropdownMenu_Option--checkIcon"),
        ).toBeTruthy();
        expect(dropdown).toMatchSnapshot();
    });
});
