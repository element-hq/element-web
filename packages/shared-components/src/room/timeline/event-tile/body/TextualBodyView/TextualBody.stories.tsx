/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactElement, type ReactNode } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    TextualBodyView,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
    type TextualBodyViewActions,
    type TextualBodyViewSnapshot,
} from "./TextualBodyView";

type WrapperProps = TextualBodyViewSnapshot &
    Partial<TextualBodyViewActions> & {
        body: ReactElement;
        urlPreviews?: ReactNode;
        className?: string;
    };

const TextualBodyViewWrapperImpl = ({
    body,
    urlPreviews,
    className,
    onRootClick,
    onBodyActionClick,
    onEditedMarkerClick,
    onEmoteSenderClick,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onRootClick: onRootClick ?? fn(),
        onBodyActionClick: onBodyActionClick ?? fn(),
        onEditedMarkerClick: onEditedMarkerClick ?? fn(),
        onEmoteSenderClick: onEmoteSenderClick ?? fn(),
    });

    return <TextualBodyView vm={vm} body={body} urlPreviews={urlPreviews} className={className} />;
};

const TextualBodyViewWrapper = withViewDocs(TextualBodyViewWrapperImpl, TextualBodyView);

const DefaultBody = <div>Hello, this is a textual message.</div>;
const Preview = (
    <div
        style={{
            marginTop: "8px",
            padding: "8px",
            borderRadius: "8px",
            backgroundColor: "var(--cpd-color-bg-subtle-secondary)",
        }}
    >
        URL preview
    </div>
);

const TEXTUAL_BODY_VIEW_KIND_OPTIONS = [
    TextualBodyViewKind.TEXT,
    TextualBodyViewKind.NOTICE,
    TextualBodyViewKind.EMOTE,
    TextualBodyViewKind.CAPTION,
];

const TEXTUAL_BODY_VIEW_BODY_WRAPPER_KIND_OPTIONS = [
    TextualBodyViewBodyWrapperKind.NONE,
    TextualBodyViewBodyWrapperKind.LINK,
    TextualBodyViewBodyWrapperKind.ACTION,
];

const meta = {
    title: "Timeline/Timeline Body/TextualBody",
    component: TextualBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        kind: {
            options: TEXTUAL_BODY_VIEW_KIND_OPTIONS,
            control: { type: "select" },
        },
        bodyWrapper: {
            options: TEXTUAL_BODY_VIEW_BODY_WRAPPER_KIND_OPTIONS,
            control: { type: "select" },
        },
    },
    args: {
        kind: TextualBodyViewKind.TEXT,
        bodyWrapper: TextualBodyViewBodyWrapperKind.NONE,
        body: DefaultBody,
        urlPreviews: undefined,
        showEditedMarker: false,
        editedMarkerText: "(edited)",
        editedMarkerTooltip: "Edited yesterday at 11:48",
        editedMarkerCaption: "View edit history",
        showPendingModerationMarker: false,
        pendingModerationText: "(Visible to you while moderation is pending)",
        emoteSenderName: "Alice",
        bodyActionAriaLabel: "Open starter link",
    },
} satisfies Meta<typeof TextualBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Notice: Story = {
    args: {
        kind: TextualBodyViewKind.NOTICE,
        body: <div>This is a notice message.</div>,
    },
};

export const CaptionWithPreview: Story = {
    args: {
        kind: TextualBodyViewKind.CAPTION,
        body: <div>Caption for the uploaded image.</div>,
        urlPreviews: Preview,
    },
};

export const Edited: Story = {
    args: {
        showEditedMarker: true,
    },
};

/**
 * An edited message whose code block is wider than the timeline, as when the right panel is open.
 * The text must wrap within the container and only the code block may scroll horizontally.
 */
export const EditedWithWideCodeBlock: Story = {
    args: {
        showEditedMarker: true,
        body: (
            <div>
                <p>Text before the code block should wrap within the timeline instead of being cut off.</p>
                {/* The host app gives code blocks horizontal scrolling; mirror that here. */}
                <pre style={{ overflowX: "auto" }}>
                    <code>
                        {"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor\n"}
                        {"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip"}
                    </code>
                </pre>
                <p>Text after the code block should wrap too.</p>
            </div>
        ),
    },
    parameters: {
        a11y: {
            config: {
                rules: [
                    {
                        // Browsers make overflowing scroll containers keyboard-focusable themselves, but axe
                        // only accepts an explicit tabindex, which the no-noninteractive-tabindex lint rule forbids.
                        id: "scrollable-region-focusable",
                        enabled: false,
                    },
                ],
            },
        },
    },
    decorators: [
        (Story): JSX.Element => (
            <div style={{ width: 320 }}>
                <Story />
            </div>
        ),
    ],
};

export const PendingModeration: Story = {
    args: {
        showPendingModerationMarker: true,
    },
};

export const HighlightLink: Story = {
    args: {
        bodyWrapper: TextualBodyViewBodyWrapperKind.LINK,
        bodyLinkHref: "https://example.org/#/room/!room:example.org/$event",
    },
};

export const StarterLink: Story = {
    args: {
        bodyWrapper: TextualBodyViewBodyWrapperKind.ACTION,
        body: <div>Launch the integration flow.</div>,
    },
};

export const Emote: Story = {
    args: {
        kind: TextualBodyViewKind.EMOTE,
        body: <span>waves enthusiastically</span>,
        showEditedMarker: true,
    },
};
