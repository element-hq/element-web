/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { render, screen } from "@test-utils";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    E2eMessageSharedIconView,
    type E2eMessageSharedIconViewModel,
    type E2eMessageSharedIconViewSnapshot,
} from "./E2eMessageSharedIconView";
import * as stories from "./E2eMessageSharedIcon.stories";

const { Default, UnknownUser } = composeStories(stories);

describe("E2eMessageSharedIconView", () => {
    it("renders the default shared-message icon", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
    });

    it("renders an unknown user tooltip state", () => {
        const { container } = render(<UnknownUser />);

        expect(container).toMatchSnapshot();
    });

    it("applies a custom className to the icon container", () => {
        const vm = new MockViewModel<E2eMessageSharedIconViewSnapshot>({
            displayName: "Bob",
            userId: "@bob:example.com",
        }) as E2eMessageSharedIconViewModel;

        render(<E2eMessageSharedIconView vm={vm} className="custom-shared-icon" />);

        expect(screen.getByTestId("e2e-padlock")).toHaveClass("custom-shared-icon");
    });

    it("uses the shared translation for the icon accessible name", () => {
        render(<Default />);

        expect(screen.getByTestId("e2e-padlock")).toHaveAccessibleName(
            "Bob (@bob:example.com) shared this message since you were not in the room when it was sent.",
        );
    });
});
