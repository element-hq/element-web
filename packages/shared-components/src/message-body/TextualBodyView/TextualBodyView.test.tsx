/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React, { type MouseEventHandler } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../viewmodel";
import {
    TextualBodyView,
    type TextualBodyViewActions,
    type TextualBodyViewModel,
    type TextualBodyViewSnapshot,
} from "./TextualBodyView";
import * as stories from "./TextualBodyView.stories";

const { Default, Emote, WithWidgets } = composeStories(stories);

describe("TextualBodyView", () => {
    it("renders the default textual body", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the emote variant", () => {
        const { container } = render(<Emote />);
        expect(container).toMatchSnapshot();
    });

    it("renders markers and widgets", () => {
        const { container } = render(<WithWidgets />);
        expect(container).toMatchSnapshot();
    });

    it("invokes edited marker and emote sender actions", async () => {
        const user = userEvent.setup();

        const onEditedMarkerClick = vi.fn();
        const onEmoteSenderClick = vi.fn();

        class TestTextualBodyViewModel
            extends MockViewModel<TextualBodyViewSnapshot>
            implements TextualBodyViewActions
        {
            public onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
            public onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;

            public constructor(snapshot: TextualBodyViewSnapshot, actions: TextualBodyViewActions) {
                super(snapshot);
                Object.assign(this, actions);
            }
        }

        const vm = new TestTextualBodyViewModel(
            {
                kind: "emote",
                body: "waves",
                emoteSender: "Alice",
                editedMarkerText: "(edited)",
                editedMarkerLabel: "Message edited",
            },
            {
                onEditedMarkerClick,
                onEmoteSenderClick,
            },
        ) as TextualBodyViewModel;

        render(<TextualBodyView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Alice" }));
        await user.click(screen.getByRole("button", { name: "Message edited" }));

        expect(onEmoteSenderClick).toHaveBeenCalledTimes(1);
        expect(onEditedMarkerClick).toHaveBeenCalledTimes(1);
    });

    it("applies custom className to the root", () => {
        const vm = new MockViewModel<TextualBodyViewSnapshot>({
            kind: "text",
            body: "hello world",
        }) as TextualBodyViewModel;

        render(<TextualBodyView vm={vm} className="custom-textual-body another-class" />);

        const root = screen.getByText("hello world").closest("div");
        expect(root).toHaveClass("custom-textual-body", "another-class");
    });
});
