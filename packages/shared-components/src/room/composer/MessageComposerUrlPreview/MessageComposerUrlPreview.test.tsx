/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./MessageComposerUrlPreview.stories.tsx";
import { MessageComposerUrlPreviewView, type MessageComposerUrlPreviewSnapshot } from "./MessageComposerUrlPreview";
import { MockViewModel } from "../../../core/viewmodel";
import { LinkedTextContext } from "../../../core/utils/LinkedText";

const { Default, WithImage } = composeStories(stories);

describe("MessageComposerUrlPreview", () => {
    it("renders a preview", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a preview with an image", () => {
        const { container } = render(<WithImage />);
        expect(container).toMatchSnapshot();
    });
    it("renders the expanded previews when not collapsed", () => {
        // The stories always render with `collapsed={true}`, so drive the view directly to
        // cover the expanded branch (equivalent to the composerUrlPreviewCollapsed setting being false).
        const snapshot: MessageComposerUrlPreviewSnapshot = {
            content: "https://matrix.org",
            entries: Default.args.entries!,
        };
        const vm = new MockViewModel(snapshot);
        const { container } = render(
            <LinkedTextContext.Provider value={{}}>
                <MessageComposerUrlPreviewView
                    vm={vm}
                    collapsed={false}
                    toggleCollapsed={() => {}}
                    removePreview={() => {}}
                />
            </LinkedTextContext.Provider>,
        );
        expect(container).toMatchSnapshot();
    });
});
