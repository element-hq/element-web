/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";

import * as stories from "./RichItem.stories";

const { Default, Selected, WithoutTimestamp } = composeStories(stories);

describe("RichItem", () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date("2025-08-01T12:00:00Z"));
    });

    it("renders the item in default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the item in selected state", () => {
        const { container } = render(<Selected />);
        expect(container).toMatchSnapshot();
    });

    it("renders the item without timestamp", () => {
        const { container } = render(<WithoutTimestamp />);
        expect(container).toMatchSnapshot();
    });
});
