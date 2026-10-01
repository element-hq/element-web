/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type StoryObj, type Meta } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AttachmentIcon, ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { UploadButton, type UploadButtonViewActions, type UploadButtonViewSnapshot } from "./UploadButton";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

const UploadButtonWrapperImpl = ({
    onUploadOptionSelected,
    defaultOpen,
    ...rest
}: UploadButtonViewSnapshot & UploadButtonViewActions & { defaultOpen: boolean }): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onUploadOptionSelected,
    });
    return <UploadButton defaultOpen={defaultOpen} vm={vm} />;
};

const UploadButtonWrapper = withViewDocs(UploadButtonWrapperImpl, UploadButton);

const meta = {
    title: "Room/UploadButton",
    component: UploadButtonWrapper,
    tags: ["autodocs"],
    args: {
        defaultOpen: false,
        onUploadOptionSelected: fn(),
        options: [
            {
                type: "local",
                label: "Attachment",
                icon: AttachmentIcon,
            },
            {
                label: "Fun Button",
                icon: ReactionIcon,
                type: "fun",
            },
        ],
    },
} satisfies Meta<typeof UploadButtonWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithOneOption: Story = {
    // No visible difference
    tags: ["skip-test"],
    args: {
        options: [
            {
                type: "local",
                label: "Attachment",
                icon: AttachmentIcon,
            },
        ],
    },
};

export const WithOpen: Story = {
    args: {
        defaultOpen: true,
    },
    parameters: {
        a11y: {
            config: {
                rules: [
                    {
                        // Menu contains a header which is invalid
                        id: "aria-required-children",
                        enabled: false,
                    },
                    {
                        // Menu pops open by default
                        id: "aria-hidden-focus",
                        enabled: false,
                    },
                ],
            },
        },
    },
};
