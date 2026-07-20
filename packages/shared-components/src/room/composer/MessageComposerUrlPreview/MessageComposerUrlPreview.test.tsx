/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./MessageComposerUrlPreview.stories.tsx";
import {
    MessageComposerUrlPreviewView,
    type MessageComposerUrlPreviewSnapshot,
    type MessageComposerUrlPreviewSnapshotEntry,
} from "./MessageComposerUrlPreview";
import { MockViewModel } from "../../../core/viewmodel";
import { LinkedTextContext } from "../../../core/utils/LinkedText";

const { Default, WithImage } = composeStories(stories);

function renderView(entries: MessageComposerUrlPreviewSnapshotEntry[], collapsed: boolean): ReturnType<typeof render> {
    const snapshot: MessageComposerUrlPreviewSnapshot = {
        content: entries.map((entry) => entry.matched_url).join(" "),
        entries,
    };
    const vm = new MockViewModel(snapshot);
    return render(
        <LinkedTextContext.Provider value={{}}>
            <MessageComposerUrlPreviewView
                vm={vm}
                collapsed={collapsed}
                toggleCollapsed={() => {}}
                removePreview={() => {}}
            />
        </LinkedTextContext.Provider>,
    );
}

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

    const loadingEntry: MessageComposerUrlPreviewSnapshotEntry = {
        status: "loading",
        matched_url: "https://element.io",
        include: true,
    };
    const failedEntry: MessageComposerUrlPreviewSnapshotEntry = {
        status: "failed",
        matched_url: "https://example.com",
        include: true,
    };

    describe("loading entries", () => {
        it("renders the loading placeholder when expanded", () => {
            const { container } = renderView([loadingEntry], false);
            expect(screen.getByText("Fetching preview...")).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        it("renders the loading summary icon when collapsed", () => {
            const { container } = renderView([loadingEntry], true);
            expect(screen.getByText("1 link")).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    describe("failed entries", () => {
        it("renders the failed placeholder when expanded", () => {
            const { container } = renderView([failedEntry], false);
            expect(screen.getByText("Failed to fetch preview")).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        it("renders the failed summary icon when collapsed", () => {
            const { container } = renderView([failedEntry], true);
            expect(screen.getByText("1 link")).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });

    it("renders a mix of loaded, loading and failed entries", () => {
        const entries: MessageComposerUrlPreviewSnapshotEntry[] = [
            Default.args.entries![0],
            loadingEntry,
            failedEntry,
        ];
        const { container } = renderView(entries, false);
        expect(screen.getByText("Fetching preview...")).toBeInTheDocument();
        expect(screen.getByText("Failed to fetch preview")).toBeInTheDocument();
        expect(screen.getByText("3 links")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
