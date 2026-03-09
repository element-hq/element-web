/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { EventContentBodyView, type EventContentBodyViewSnapshot } from "./EventContentBodyView";
import styles from "./EventContentBody.module.css";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type EventContentBodyStoryProps = EventContentBodyViewSnapshot & {
    as: "div" | "span";
};

const EventContentBodyWrapperImpl = ({ as, ...snapshot }: EventContentBodyStoryProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, {});
    return <EventContentBodyView vm={vm} as={as} />;
};
const EventContentBodyWrapper = withViewDocs(EventContentBodyWrapperImpl, EventContentBodyView);

const meta = {
    title: "MessageBody/EventContentBody",
    component: EventContentBodyWrapper,
    tags: ["autodocs"],
    args: {
        as: "div",
        className: styles.EventTile_body,
        dir: "auto",
    },
} satisfies Meta<typeof EventContentBodyWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
    args: {
        body: "Hello, this is a plain text message.",
        className: styles.EventTile_body,
    },
};

export const BigEmoji: Story = {
    args: {
        body: [
            <span key="wave" className={styles.Emoji} title=":wave:">
                👋
            </span>,
            <span key="smile" className={styles.Emoji} title=":smile:">
                😊
            </span>,
        ],
        className: `${styles.EventTile_body} ${styles.EventTile_bigEmoji}`,
    },
};

export const HtmlContent: Story = {
    args: {
        body: "This is bold and italic text with a link.",
        formattedBody:
            "<p>This is <strong>bold</strong> and <em>italic</em> text with a <a href='https://matrix.org'>link</a>.</p>",
        className: `${styles.EventTile_body} ${styles.markdownBody}`,
    },
};

export const CodeBlock: Story = {
    args: {
        body: 'function hello() {\n  console.log("Hello, world!");\n}',
        formattedBody: '<pre><code>function hello() {\n  console.log("Hello, world!");\n}</code></pre>',
        className: `${styles.EventTile_body} ${styles.markdownBody}`,
    },
};

export const AsSpan: Story = {
    args: {
        as: "span",
        body: "This is rendered as a span element.",
        className: styles.EventTile_body,
    },
};

export const WithHighlight: Story = {
    args: {
        body: "Message with a highlighted word.",
        formattedBody: `Message with a <span class="${styles.EventTile_searchHighlight}">highlighted</span> word.`,
        className: styles.EventTile_body,
    },
};
