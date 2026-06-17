/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    ReplyTileView,
    type ReplyTileViewActions,
    type ReplyTileViewModel,
    type ReplyTileViewSnapshot,
} from "./ReplyTileView";
import * as stories from "./ReplyTileView.stories";

const { Default, Inline, Info, NoRenderer } = composeStories(stories);

class TestReplyTileViewModel extends MockViewModel<ReplyTileViewSnapshot> implements ReplyTileViewActions {
    public constructor(
        snapshot: ReplyTileViewSnapshot,
        public onClick: ReplyTileViewActions["onClick"],
    ) {
        super(snapshot);
    }
}

describe("ReplyTileView", () => {
    it("renders the default reply tile", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
    });

    it("renders the inline reply tile", () => {
        const { container } = render(<Inline />);

        expect(container).toMatchSnapshot();
    });

    it("renders the info reply tile", () => {
        const { container } = render(<Info />);

        expect(container).toMatchSnapshot();
    });

    it("renders the no-renderer fallback", () => {
        render(<NoRenderer />);

        expect(screen.getByText("Unable to render message")).toHaveAttribute("data-reply-tile");
    });

    it("invokes the reply action from the wrapper link but not nested links", () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const onClick = vi.fn();
        const vm = new TestReplyTileViewModel(
            {
                permalink: "#event",
                isInline: false,
                isInfoMessage: false,
                showSender: false,
            },
            onClick,
        ) as ReplyTileViewModel;

        render(
            <ReplyTileView vm={vm}>
                <span data-reply-body-content="">
                    <span>
                        Reply body <a href="https://example.org">nested link</a>
                    </span>
                </span>
            </ReplyTileView>,
        );

        fireEvent.click(screen.getByText("nested link"));
        expect(onClick).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Reply body"));
        expect(onClick).toHaveBeenCalledTimes(1);

        consoleErrorSpy.mockRestore();
    });
});
