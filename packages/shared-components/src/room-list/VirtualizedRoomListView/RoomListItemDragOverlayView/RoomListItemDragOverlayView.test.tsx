/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./RoomListItemDragOverlayView.stories";
import { defaultSnapshot } from "../RoomListItemAccessibilityWrapper/RoomListItemView/default-snapshot";

const { Default } = composeStories(stories);

describe("<RoomListItemDragOverlayView />", () => {
    it("renders the room name from the view model", () => {
        render(<Default />);
        expect(screen.getByTestId("room-name")).toHaveTextContent(defaultSnapshot.name);
    });
});
