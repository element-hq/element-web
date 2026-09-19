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

const { Docked, FullWidth, MiniMode, WithOverlay, Hidden } = composeStories(stories);

describe("ElementCallAppTileView", () => {
    it("renders the call in a persisted root, docked", () => {
        const { container } = render(<Docked />);
        expect(container.querySelector(".mx_AppTile .mx_AppTile_persistedWrapper")).not.toBeNull();
        expect(container.querySelector(".mx_AppTileBody.mx_AppTileBody--large.mx_AppTileBody--call")).not.toBeNull();
        expect(container).toMatchSnapshot();
    });

    it("fills the container width when asked", () => {
        const { container } = render(<FullWidth />);
        expect(container.querySelector(".mx_AppTileFullWidth")).not.toBeNull();
        expect(container).toMatchSnapshot();
    });

    it("uses the mini classes in miniMode", () => {
        const { container } = render(<MiniMode />);
        expect(container.querySelector(".mx_AppTile_mini")).not.toBeNull();
        expect(container.querySelector(".mx_AppTileBody--mini.mx_AppTileBody--call")).not.toBeNull();
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
        const { container } = render(<Docked pointerEvents="none" />);
        expect(container.querySelector<HTMLElement>(".mx_AppTileBody")!.style.pointerEvents).toBe("none");
    });
});
