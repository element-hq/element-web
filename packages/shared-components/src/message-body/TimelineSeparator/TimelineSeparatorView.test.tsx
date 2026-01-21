/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";

import * as stories from "./TimelineSeparatorView.stories.tsx";

const { Default, WithHtmlChild, WithoutChildren, WithDateEvent, WithLateEvent } = composeStories(stories);

describe("TimelineSeparatorView", () => {
    afterEach(() => {
        jest.clearAllMocks();
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

        it("renders the timeline separator without children", () => {
            const { container } = render(<WithDateEvent />);
            expect(container).toMatchSnapshot();
        });
        
        it("renders the timeline separator without children", () => {
            const { container } = render(<WithLateEvent />);
            expect(container).toMatchSnapshot();
        });
        it("renders the timeline separator without children", () => {
            const { container } = render(<WithoutChildren />);
            expect(container).toMatchSnapshot();
        });
    });
});
