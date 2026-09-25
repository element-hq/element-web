/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    LegacyCryptoUnsupportedView,
    type LegacyCryptoUnsupportedViewActions,
    type LegacyCryptoUnsupportedViewSnapshot,
} from "./LegacyCryptoUnsupportedView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type WrapperProps = LegacyCryptoUnsupportedViewSnapshot & LegacyCryptoUnsupportedViewActions;

const LegacyCryptoUnsupportedViewWrapperImpl = ({ onSignOutClick, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, { onSignOutClick });
    return <LegacyCryptoUnsupportedView vm={vm} />;
};
const LegacyCryptoUnsupportedViewWrapper = withViewDocs(
    LegacyCryptoUnsupportedViewWrapperImpl,
    LegacyCryptoUnsupportedView,
);

const meta = {
    title: "Crypto/LegacyCryptoUnsupportedView",
    component: LegacyCryptoUnsupportedViewWrapper,
    tags: ["autodocs"],
    args: {
        brand: "Element",
        version: "v1.12.29",
        onSignOutClick: fn(),
    },
    parameters: {
        layout: "fullscreen",
    },
} satisfies Meta<typeof LegacyCryptoUnsupportedViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
