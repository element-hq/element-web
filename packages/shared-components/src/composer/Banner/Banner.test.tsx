/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";

import * as stories from "./Banner.stories.tsx";

const { Default, Info, Success, WithAction, WithAvatarImage, Critical } = composeStories(stories);

describe("AvatarWithDetails", () => {
    it("renders a default banner", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a info banner", () => {
        const { container } = render(<Info />);
        expect(container).toMatchSnapshot();
    });
    it("renders a success banner", () => {
        const { container } = render(<Success />);
        expect(container).toMatchSnapshot();
    });
    it("renders a critical banner", () => {
        const { container } = render(<Critical />);
        expect(container).toMatchSnapshot();
    });
    it("renders a banner with an action", () => {
        const { container } = render(<WithAction />);
        expect(container).toMatchSnapshot();
    });
    it("renders a banner with an avatar iamge", () => {
        const { container } = render(<WithAvatarImage />);
        expect(container).toMatchSnapshot();
    });
});
