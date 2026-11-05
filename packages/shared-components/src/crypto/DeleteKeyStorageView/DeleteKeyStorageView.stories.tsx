/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    DeleteKeyStorageView,
    type DeleteKeyStorageViewActions,
    type DeleteKeyStorageViewSnapshot,
} from "./DeleteKeyStorageView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type WrapperProps = DeleteKeyStorageViewSnapshot & DeleteKeyStorageViewActions;

const DeleteKeyStorageViewWrapperImpl = ({ confirm, cancel, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, { confirm, cancel });
    return <DeleteKeyStorageView vm={vm} />;
};
const DeleteKeyStorageViewWrapper = withViewDocs(DeleteKeyStorageViewWrapperImpl, DeleteKeyStorageView);

const meta = {
    title: "Crypto/DeleteKeyStorageView",
    component: DeleteKeyStorageViewWrapper,
    tags: ["autodocs"],
    args: {
        busy: false,
        failed: false,
        confirm: fn(),
        cancel: fn(),
    },
    // The view sits inside a dialog in the app, so constrain it to a dialog's width.
    decorators: [
        (Story) => (
            <div style={{ width: "480px" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof DeleteKeyStorageViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Busy: Story = {
    args: { busy: true },
};

export const Failed: Story = {
    args: { failed: true },
};
