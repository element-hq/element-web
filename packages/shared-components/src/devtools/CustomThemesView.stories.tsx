/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import {
    CustomThemeError,
    CustomThemesView,
    type CustomThemesViewActions,
    type CustomThemesViewSnapshot,
} from "./CustomThemesView";
import { useMockedViewModel } from "../core/viewmodel";
import { withViewDocs } from "../../.storybook/withViewDocs";

const CustomThemesViewWrapperImpl = ({
    setUrl,
    addTheme,
    removeTheme,
    refreshTheme,
    ...snapshot
}: CustomThemesViewSnapshot & CustomThemesViewActions): JSX.Element => {
    const vm = useMockedViewModel<CustomThemesViewSnapshot, CustomThemesViewActions>(snapshot, {
        setUrl,
        addTheme,
        removeTheme,
        refreshTheme,
    });
    return <CustomThemesView vm={vm} />;
};

const CustomThemesViewWrapper = withViewDocs(CustomThemesViewWrapperImpl, CustomThemesView);

const meta = {
    title: "Devtools/CustomThemesView",
    component: CustomThemesViewWrapper,
    tags: ["autodocs"],
    args: {
        themes: [],
        url: "",
        isDownloading: false,
        error: null,
        setUrl: fn(),
        addTheme: fn(),
        removeTheme: fn(),
        refreshTheme: fn(),
    },
} satisfies Meta<typeof CustomThemesViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A theme added before we started recording the URL it came from, so it cannot be refreshed. */
const LEGACY_THEME = { name: "Alice theme", canRefresh: false, isRefreshing: false, error: null };
const REFRESHABLE_THEME = { name: "Bob theme", canRefresh: true, isRefreshing: false, error: null };

export const Empty: Story = {};

export const WithThemes: Story = {
    args: {
        themes: [LEGACY_THEME, REFRESHABLE_THEME],
    },
};

export const Refreshing: Story = {
    args: {
        themes: [{ ...REFRESHABLE_THEME, isRefreshing: true }],
    },
};

export const RefreshFailed: Story = {
    args: {
        themes: [{ ...REFRESHABLE_THEME, error: CustomThemeError.DownloadFailed }],
    },
};

export const Downloading: Story = {
    args: {
        url: "https://example.org/theme.json",
        isDownloading: true,
    },
};

export const InvalidSchema: Story = {
    args: {
        url: "https://example.org/not-a-theme.json",
        error: CustomThemeError.InvalidSchema,
    },
};

export const DownloadFailed: Story = {
    args: {
        url: "https://example.org/missing.json",
        error: CustomThemeError.DownloadFailed,
    },
};

export const AlreadyInstalled: Story = {
    args: {
        themes: [LEGACY_THEME],
        url: "https://example.org/alice.json",
        error: CustomThemeError.AlreadyInstalled,
    },
};
