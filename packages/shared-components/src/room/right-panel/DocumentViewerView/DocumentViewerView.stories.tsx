/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentViewerView, type DocumentViewerViewProps } from "./DocumentViewerView";

function DocumentViewerStory(props: DocumentViewerViewProps): JSX.Element {
    return (
        <div style={{ width: 420, height: 560 }}>
            <DocumentViewerView {...props}>
                <div style={{ padding: 16 }}>The document surface, drawn by the viewer built on this shell.</div>
            </DocumentViewerView>
        </div>
    );
}

const meta = {
    title: "Room/Right Panel/DocumentViewerView",
    component: DocumentViewerStory,
    tags: ["autodocs"],
    parameters: {
        layout: "centered",
    },
    argTypes: {
        status: {
            options: ["loading", "ready", "error"],
            control: { type: "select" },
        },
    },
    args: {
        status: "ready",
    },
} satisfies Meta<typeof DocumentViewerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const WithToolbar: Story = {
    args: {
        toolbar: <span>Toolbar controls</span>,
    },
};

export const Loading: Story = {
    args: {
        status: "loading",
    },
};

export const ErrorState: Story = {
    args: {
        status: "error",
    },
};
