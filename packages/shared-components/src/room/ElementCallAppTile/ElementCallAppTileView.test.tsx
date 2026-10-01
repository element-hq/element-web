/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./ElementCallAppTileView.stories.tsx";

const { Default, WithClassNames, WithOverlay, Hidden } = composeStories(stories);

describe("ElementCallAppTileView", () => {
    it("renders the call in a persisted root", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("puts the application's class names on the tile's elements", () => {
        const { container } = render(<WithClassNames />);
        expect(container.querySelector(".tile > .persistedWrapper > .body")).not.toBeNull();
        expect(container).toMatchSnapshot();
    });

    it("renders the overlay inside the persisted root", () => {
        const { container, getByTestId } = render(<WithOverlay />);
        expect(getByTestId("overlay")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders nothing when there is no call", () => {
        const { container } = render(<Hidden />);
        expect(container).toBeEmptyDOMElement();
    });

    it("applies pointerEvents to the call's body", () => {
        const { container } = render(<WithClassNames pointerEvents="none" />);
        expect(container.querySelector<HTMLElement>(".body")!.style.pointerEvents).toBe("none");
    });
});
