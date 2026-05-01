/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Meta, type StoryFn } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AttachmentIcon, ReactionIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { UploadButton, type UploadButtonViewActions, type UploadButtonViewSnapshot } from "./UploadButton";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

const UploadButtonWrapperImpl = ({
    onUploadOptionSelected,
    ...rest
}: UploadButtonViewSnapshot & UploadButtonViewActions): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onUploadOptionSelected,
    });
    return <UploadButton vm={vm} />;
};

const UploadButtonWrapper = withViewDocs(UploadButtonWrapperImpl, UploadButton);

export default {
    title: "Room/UploadButton",
    component: UploadButtonWrapper,
    tags: ["autodocs"],
    args: {
        onUploadOptionSelected: fn(),
        options: [
            {
                type: "local",
                label: "Attachment",
                icon: AttachmentIcon,
            },
        ],
    },
} satisfies Meta<typeof UploadButtonWrapper>;

const Template: StoryFn<typeof UploadButtonWrapper> = (args) => <UploadButtonWrapper {...args} />;

export const Default = Template.bind({});
Default.args = {
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
};

export const WithOneOption = Template.bind({});

WithOneOption.args = {
    options: [
        {
            type: "local",
            label: "Attachment",
            icon: AttachmentIcon,
        },
    ],
};
