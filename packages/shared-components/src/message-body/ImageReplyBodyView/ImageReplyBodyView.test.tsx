/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "@test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../viewmodel";
import {
    ImageReplyBodyView,
    type ImageReplyBodyViewModel,
    type ImageReplyBodyViewSnapshot,
} from "./ImageReplyBodyView";
import * as stories from "./ImageReplyBodyView.stories";

const { Default, Empty, Hidden } = composeStories(stories);

describe("ImageReplyBodyView", () => {
    it("renders the default reply image body", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders an empty reply image body container", () => {
        const { container } = render(<Empty />);
        expect(container).toMatchSnapshot();
    });

    it("does not render when hidden", () => {
        const { container } = render(<Hidden />);
        expect(container).toMatchSnapshot();
    });

    it("applies a custom className to the container", () => {
        const vm = new MockViewModel<ImageReplyBodyViewSnapshot>({}) as ImageReplyBodyViewModel;
        const { container } = render(
            <ImageReplyBodyView vm={vm} className="custom-image-reply another-class">
                <span>Thumbnail</span>
            </ImageReplyBodyView>,
        );

        expect(container.firstChild).toHaveClass("custom-image-reply", "another-class");
    });
});
