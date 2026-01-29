/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { EventContentBodyView, type EventContentBodyViewSnapshot } from "./EventContentBodyView";
import styles from "./EventContentBody.module.css";

type EventContentBodyStoryProps = EventContentBodyViewSnapshot & {
    as: "div" | "span";
};

const EventContentBodyWrapper = ({ as, ...snapshot }: EventContentBodyStoryProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, {});
    return <EventContentBodyView vm={vm} as={as} />;
};

export default {
    title: "MessageBody/EventContentBody",
    component: EventContentBodyWrapper,
    tags: ["autodocs"],
    args: {
        as: "div",
        className: styles.EventTile_body,
        dir: "auto",
    },
} as Meta<typeof EventContentBodyWrapper>;

const Template: StoryFn<typeof EventContentBodyWrapper> = (args) => <EventContentBodyWrapper {...args} />;

export const PlainText = Template.bind({});
PlainText.args = {
    children: "Hello, this is a plain text message.",
    className: styles.EventTile_body,
};

export const BigEmoji = Template.bind({});
BigEmoji.args = {
    children: (
        <>
            <span className={styles.Emoji} title=":wave:">
                👋
            </span>
            <span className={styles.Emoji} title=":smile:">
                😊
            </span>
        </>
    ),
    className: `${styles.EventTile_body} ${styles.EventTile_bigEmoji}`,
};

export const HtmlContent = Template.bind({});
HtmlContent.args = {
    children: (
        <p>
            This is <strong>bold</strong> and <em>italic</em> text with a <a href="https://matrix.org">link</a>.
        </p>
    ),
    className: `${styles.EventTile_body} ${styles.markdownBody}`,
};

export const CodeBlock = Template.bind({});
CodeBlock.args = {
    children: (
        <pre>
            <code>{`function hello() {\n  console.log("Hello, world!");\n}`}</code>
        </pre>
    ),
    className: `${styles.EventTile_body} ${styles.markdownBody}`,
};

export const AsSpan = Template.bind({});
AsSpan.args = {
    as: "span",
    children: "This is rendered as a span element.",
    className: `${styles.EventTile_body}`,
};

export const WithHighlight = Template.bind({});
WithHighlight.args = {
    children: (
        <>
            Message with a <span className={styles.EventTile_searchHighlight}>highlighted</span> word.
        </>
    ),
    className: styles.EventTile_body,
};
