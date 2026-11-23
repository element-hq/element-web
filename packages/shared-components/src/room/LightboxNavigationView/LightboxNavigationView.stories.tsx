/*
 * Copyright 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    LightboxNavigationView,
    type LightboxNavigationViewActions,
    type LightboxNavigationViewSnapshot,
} from "./LightboxNavigationView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type LightboxNavigationProps = LightboxNavigationViewSnapshot & LightboxNavigationViewActions;

const LightboxNavigationViewWrapperImpl = ({
    goToPrevious,
    goToNext,
    ...rest
}: LightboxNavigationProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { goToPrevious, goToNext });
    return (
        // The lightbox shows the image on a dark backdrop
        <div style={{ background: "rgba(0, 0, 0, 0.9)", padding: "var(--cpd-space-4x) 0" }}>
            <LightboxNavigationView vm={vm}>
                <div
                    style={{
                        flex: 1,
                        height: "200px",
                        background: "var(--cpd-color-bg-subtle-secondary)",
                        borderRadius: "var(--cpd-space-2x)",
                    }}
                    role="img"
                    aria-label="Image"
                />
            </LightboxNavigationView>
        </div>
    );
};
const LightboxNavigationViewWrapper = withViewDocs(LightboxNavigationViewWrapperImpl, LightboxNavigationView);

const meta = {
    title: "Room/LightboxNavigationView",
    component: LightboxNavigationViewWrapper,
    tags: ["autodocs"],
    args: {
        canGoToPrevious: true,
        canGoToNext: true,
        isNavigating: false,
        goToPrevious: fn(),
        goToNext: fn(),
    },
} satisfies Meta<typeof LightboxNavigationViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An image with both older and newer images around it: both buttons are shown.
 */
export const Default: Story = {};

/**
 * The oldest image: only the "Next" button is shown. The empty gutter keeps the image centred.
 */
export const FirstImage: Story = {
    args: {
        canGoToPrevious: false,
    },
};

/**
 * Older history is being fetched to find the previous image: the buttons are disabled meanwhile.
 */
export const Navigating: Story = {
    args: {
        isNavigating: true,
    },
};
