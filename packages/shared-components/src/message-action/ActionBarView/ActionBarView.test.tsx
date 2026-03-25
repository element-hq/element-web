/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as stories from "./ActionBarView.stories.tsx";
import {
    ActionBarAction,
    type ActionBarViewActions,
    ActionBarView,
    type ActionBarViewSnapshot,
} from "./ActionBarView.tsx";
import { MockViewModel } from "../../viewmodel/MockViewModel.ts";

const composedStories = composeStories(stories);

const {
    FailedMessage,
    DownloadingAttachment,
    DecryptingAttachment,
    PinnedMessage,
    ExpandedReplyChain,
    ThreadReplyDisabled,
    DeletedMessageThreadOnly,
    Minimal,
} = composedStories;

describe("ActionBarView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("story snapshots", () => {
        for (const [storyName, Story] of Object.entries(composedStories)) {
            it(`renders ${storyName}`, () => {
                const { container } = render(<Story />);

                expect(screen.getByRole("toolbar")).toBeInTheDocument();
                expect(container).toMatchSnapshot();
            });
        }
    });

    it("renders the failed-message branch with retry and delete only", () => {
        render(<FailedMessage />);

        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /options/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
    });

    it("renders a loading download action with the downloading label", () => {
        render(<DownloadingAttachment />);

        const button = screen.getByRole("button", { name: /downloading/i });
        expect(button).toBeDisabled();
    });

    it("renders a loading download action with the decrypting label for encrypted media", () => {
        render(<DecryptingAttachment />);

        const button = screen.getByRole("button", { name: /decrypting/i });
        expect(button).toBeDisabled();
    });

    it("renders the pinned message state with an unpin action", () => {
        render(<PinnedMessage />);

        expect(screen.getByRole("button", { name: /unpin/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^pin$/i })).not.toBeInTheDocument();
    });

    it("renders the expanded reply chain state with a collapse action", () => {
        render(<ExpandedReplyChain />);

        expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
    });

    it("renders a disabled thread reply button when thread reply is not allowed", () => {
        render(<ThreadReplyDisabled />);

        const threadButton = screen.getByRole("button", { name: /reply in thread/i });
        expect(threadButton).toHaveAttribute("aria-disabled", "true");
    });

    it("renders a thread action for deleted messages even when reply is hidden", () => {
        render(<DeletedMessageThreadOnly />);

        expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reply$/i })).not.toBeInTheDocument();
    });

    it("renders only the options button in the minimal state", () => {
        render(<Minimal />);

        expect(screen.getByRole("button", { name: /options/i })).toBeInTheDocument();
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("uses roving tab index and arrow keys within the toolbar", async () => {
        const user = userEvent.setup();

        const { rerender } = render(<Minimal />);

        const optionsButton = screen.getByRole("button", { name: /options/i });
        expect(optionsButton).toHaveAttribute("tabindex", "0");

        rerender(<PinnedMessage />);

        const reactButton = screen.getByRole("button", { name: /react/i });
        const replyButton = screen.getByRole("button", { name: /^reply$/i });
        const unpinButton = screen.getByRole("button", { name: /unpin/i });
        const optionsButtonInToolbar = screen.getByRole("button", { name: /options/i });

        expect(reactButton).toHaveAttribute("tabindex", "0");
        expect(replyButton).toHaveAttribute("tabindex", "-1");
        expect(unpinButton).toHaveAttribute("tabindex", "-1");
        expect(optionsButtonInToolbar).toHaveAttribute("tabindex", "-1");

        await user.tab();
        expect(reactButton).toHaveFocus();

        await user.keyboard("{ArrowRight}");
        expect(replyButton).toHaveFocus();
        expect(replyButton).toHaveAttribute("tabindex", "0");
        expect(reactButton).toHaveAttribute("tabindex", "-1");

        await user.keyboard("{End}");
        expect(optionsButtonInToolbar).toHaveFocus();
        expect(optionsButtonInToolbar).toHaveAttribute("tabindex", "0");

        await user.keyboard("{ArrowLeft}");
        expect(unpinButton).toHaveFocus();
        expect(unpinButton).toHaveAttribute("tabindex", "0");
    });

    it("applies a custom class name to the toolbar", () => {
        const vm = new MockViewModel<ActionBarViewSnapshot>({
            actions: [ActionBarAction.Options],
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        });

        render(<ActionBarView vm={vm} className="extra_class_1 extra_class_2" />);

        expect(screen.getByRole("toolbar")).toHaveClass("extra_class_1", "extra_class_2");
    });

    it("forwards click and context-menu actions with the triggering button as anchor", async () => {
        const user = userEvent.setup();
        const onReplyClick = vi.fn();
        const onOptionsClick = vi.fn();

        class ActionBarViewModel extends MockViewModel<ActionBarViewSnapshot> implements ActionBarViewActions {
            public onReplyClick = onReplyClick;
            public onOptionsClick = onOptionsClick;
        }

        const vm = new ActionBarViewModel({
            actions: [ActionBarAction.Reply, ActionBarAction.Options],
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        });

        render(<ActionBarView vm={vm} />);

        const replyButton = screen.getByRole("button", { name: /^reply$/i });
        const optionsButton = screen.getByRole("button", { name: /options/i });

        await user.click(replyButton);
        expect(onReplyClick).toHaveBeenCalledWith(replyButton);

        fireEvent.contextMenu(optionsButton);
        expect(onOptionsClick).toHaveBeenCalledWith(optionsButton);
    });
});
