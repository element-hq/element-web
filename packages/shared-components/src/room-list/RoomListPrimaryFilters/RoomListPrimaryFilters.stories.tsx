/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListPrimaryFilters } from "./RoomListPrimaryFilters";
import type { FilterId } from "./useVisibleFilters";

const meta: Meta<typeof RoomListPrimaryFilters> = {
    title: "Room List/RoomListPrimaryFilters",
    component: RoomListPrimaryFilters,
    tags: ["autodocs"],
    args: {
        onToggleFilter: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel-2025?node-id=98-1979&t=vafb4zoYMNLRuAbh-4",
        },
    },
};

export default meta;
type Story = StoryObj<typeof RoomListPrimaryFilters>;

// All available filter IDs
const allFilterIds: FilterId[] = ["unread", "people", "rooms", "favourite", "mentions", "invites", "low_priority"];

// Subset of filters for narrow container tests
const fewFilterIds: FilterId[] = ["people", "rooms", "unread"];

export const Default: Story = {
    args: {
        filterIds: allFilterIds,
    },
};

export const PeopleSelected: Story = {
    args: {
        filterIds: allFilterIds,
        activeFilterId: "people",
    },
};

export const NoFilters: Story = {
    args: {
        filterIds: [],
    },
};

/**
 * Narrow container that causes filters to wrap.
 * The chevron button should appear to expand/collapse the filter list.
 */
export const NarrowContainer: Story = {
    args: {
        filterIds: fewFilterIds,
    },
    decorators: [
        (Story) => (
            <div style={{ width: "180px", border: "1px dashed var(--cpd-color-border-interactive-secondary)" }}>
                <Story />
            </div>
        ),
    ],
};

/**
 * Narrow container with active filter that would wrap.
 * When collapsed, the active filter should move to the front.
 */
export const NarrowWithActiveWrappingFilter: Story = {
    args: {
        filterIds: fewFilterIds,
        activeFilterId: "unread",
    },
    decorators: [
        (Story) => (
            <div style={{ width: "180px", border: "1px dashed var(--cpd-color-border-interactive-secondary)" }}>
                <Story />
            </div>
        ),
    ],
};
