/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import type { Meta, StoryFn } from "@storybook/react-vite";

import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { EventContentBodyView, type EventContentBodyViewSnapshot } from "./EventContentBodyView";

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
        className: "mx_EventTile_body",
        dir: "auto",
    },
} as Meta<typeof EventContentBodyWrapper>;

const Template: StoryFn<typeof EventContentBodyWrapper> = (args) => <EventContentBodyWrapper {...args} />;

export const PlainText = Template.bind({});
PlainText.args = {
    children: "Hello, this is a plain text message.",
    className: "mx_EventTile_body translate",
};

export const BigEmoji = Template.bind({});
BigEmoji.args = {
    children: (
        <>
            <span className="mx_Emoji" title=":wave:">
                👋
            </span>
            <span className="mx_Emoji" title=":smile:">
                😊
            </span>
        </>
    ),
    className: "mx_EventTile_body mx_EventTile_bigEmoji translate",
};

export const HtmlContent = Template.bind({});
HtmlContent.args = {
    children: (
        <p>
            This is <strong>bold</strong> and <em>italic</em> text with a <a href="https://matrix.org">link</a>.
        </p>
    ),
    className: "mx_EventTile_body markdown-body translate",
};

export const CodeBlock = Template.bind({});
CodeBlock.args = {
    children: (
        <pre>
            <code className="language-javascript">
                {`function hello() {
  console.log("Hello, world!");
}`}
            </code>
        </pre>
    ),
    className: "mx_EventTile_body markdown-body translate",
};

export const AsSpan = Template.bind({});
AsSpan.args = {
    as: "span",
    children: "This is rendered as a span element.",
    className: "mx_EventTile_body translate",
};

export const WithHighlight = Template.bind({});
WithHighlight.args = {
    children: (
        <>
            Message with a <span className="mx_EventTile_searchHighlight">highlighted</span> word.
        </>
    ),
    className: "mx_EventTile_body translate",
};
