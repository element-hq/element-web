/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { fn } from "storybook/test";

import * as stories from "./GenericToast.stories.tsx";

const { Default, Destructive, WithDetail, PrimaryOnly } = composeStories(stories);

describe("GenericToast", () => {
    it("renders with primary and secondary buttons", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders detail content", () => {
        const { container, getByText } = render(<WithDetail />);
        expect(getByText("Some more detail about the toast.")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders destructive content", () => {
        const { container, getByText } = render(<Destructive />);
        expect(getByText("You have unverified sessions.")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("omits the secondary button when no secondary action is given", () => {
        const { queryByRole, getByRole } = render(<PrimaryOnly />);
        expect(getByRole("button", { name: "Accept" })).toBeInTheDocument();
        expect(queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    });

    it("calls the click handlers", async () => {
        const onPrimaryClick = fn();
        const onSecondaryClick = fn();
        const { getByRole } = render(<Default onPrimaryClick={onPrimaryClick} onSecondaryClick={onSecondaryClick} />);

        await userEvent.click(getByRole("button", { name: "Accept" }));
        expect(onPrimaryClick).toHaveBeenCalled();
        await userEvent.click(getByRole("button", { name: "Reject" }));
        expect(onSecondaryClick).toHaveBeenCalled();
    });
});
