/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as stories from "./TimelineSeparator.stories.tsx";

const { Default, WithHtmlChild, WithoutChildren, WithDateEvent, WithLateEvent } = composeStories(stories);

describe("TimelineSeparator", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Snapshot tests", () => {
        it("renders the timeline separator in default state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator with HTML child", () => {
            const { container } = render(<WithHtmlChild />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator with date event", () => {
            const { container } = render(<WithDateEvent />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator with late event", () => {
            const { container } = render(<WithLateEvent />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator without children", () => {
            const { container } = render(<WithoutChildren />);
            expect(container).toMatchSnapshot();
        });
    });
});
