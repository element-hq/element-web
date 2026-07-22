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
    SectionCreationView,
    type SectionCreationViewActions,
    type SectionCreationViewSnapshot,
} from "./SectionCreationView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type SectionCreationProps = SectionCreationViewSnapshot & SectionCreationViewActions;

const SectionCreationViewWrapperImpl = ({
    createOrEditSection,
    setSection,
    ...rest
}: SectionCreationProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        createOrEditSection,
        setSection,
    });
    return <SectionCreationView vm={vm} />;
};
const SectionCreationViewWrapper = withViewDocs(SectionCreationViewWrapperImpl, SectionCreationView);

const meta = {
    title: "Room List/SectionCreationView",
    component: SectionCreationViewWrapper,
    tags: ["autodocs"],
    args: {
        value: "",
        step: "creation",
        isSectionValid: false,
        createOrEditSection: fn(),
        setSection: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "hhttps://www.figma.com/design/qurBlLqjf3mRNpyZ1ffamm/ER-213---Sections?node-id=1442-38764&t=XDtseNZTt6iPX8S6-4",
        },
    },
} satisfies Meta<typeof SectionCreationViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Creation mode: no existing section name, so the explanatory description is shown
 * and the text field starts empty.
 */
export const Default: Story = {};

/**
 * Edition mode: the field is pre-filled with the existing section name and the
 * description is hidden.
 */
export const Edition: Story = {
    args: {
        value: "My section",
        step: "edition",
        isSectionValid: true,
    },
};
