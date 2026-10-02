/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownViewerView, type MarkdownViewerViewProps } from "./MarkdownViewerView";

/** What a renderer produces for a typical README, already sanitized. */
const sampleHtml = `
<h1>Element Web</h1>
<p>A glossy <a href="https://matrix.org" target="_blank" rel="noreferrer noopener">Matrix</a> client for the web.
Run <code>pnpm start</code> to bring it up locally.</p>
<h2>Getting started</h2>
<ol>
<li>Install the dependencies</li>
<li>Copy <code>config.sample.json</code> to <code>config.json</code></li>
<li>Start the dev server</li>
</ol>
<pre><code class="language-sh">pnpm install
pnpm start
</code></pre>
<blockquote>
<p>Element Web is a <strong>monorepo</strong>. Run the commands from the root.</p>
</blockquote>
<h3>Scripts</h3>
<table>
<thead><tr><th>Command</th><th>Purpose</th></tr></thead>
<tbody>
<tr><td><code>pnpm lint</code></td><td>Types, formatting and lint rules</td></tr>
<tr><td><code>pnpm test:unit</code></td><td>All unit tests</td></tr>
</tbody>
</table>
<hr>
<p><em>Happy hacking!</em></p>
`;

function MarkdownViewerStory(props: MarkdownViewerViewProps): JSX.Element {
    return (
        <div style={{ width: 420, height: 560 }}>
            <MarkdownViewerView {...props} />
        </div>
    );
}

const meta = {
    title: "Room/Right Panel/MarkdownViewerView",
    component: MarkdownViewerStory,
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
        status: "loading",
        html: "",
        onContentClick: fn(),
    },
} satisfies Meta<typeof MarkdownViewerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Ready: Story = {
    args: {
        status: "ready",
        html: sampleHtml,
    },
};

export const ErrorState: Story = {
    args: {
        status: "error",
    },
};
