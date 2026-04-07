/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { createRef, type MouseEventHandler } from "react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    TextualBodyView,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
    type TextualBodyContentElement,
    type TextualBodyViewActions,
    type TextualBodyViewModel,
    type TextualBodyViewSnapshot,
} from "./TextualBodyView";
import * as stories from "./TextualBody.stories";

const { Default, Notice, CaptionWithPreview, Emote } = composeStories(stories);

describe("TextualBodyView", () => {
    it("renders the default message body", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the notice branch", () => {
        const { container } = render(<Notice />);
        expect(container).toMatchSnapshot();
    });

    it("renders caption messages with url previews", () => {
        const { container } = render(<CaptionWithPreview />);
        expect(container).toMatchSnapshot();
    });

    it("renders emote messages with annotations", () => {
        const { container } = render(<Emote />);
        expect(container).toMatchSnapshot();
    });

    it("forwards body refs to the rendered body element", () => {
        const bodyRef = createRef<TextualBodyContentElement>();
        const vm = new MockViewModel<TextualBodyViewSnapshot>({
            kind: TextualBodyViewKind.TEXT,
        }) as TextualBodyViewModel;

        render(<TextualBodyView vm={vm} body={<div>Body content</div>} bodyRef={bodyRef} />);

        expect(bodyRef.current).not.toBeNull();
        expect(bodyRef.current?.textContent).toBe("Body content");
    });

    it("invokes edited marker, body action, and emote sender handlers", async () => {
        const user = userEvent.setup();
        const onEditedMarkerClick = vi.fn();
        const onBodyActionClick = vi.fn();
        const onEmoteSenderClick = vi.fn();

        class TestTextualBodyViewModel
            extends MockViewModel<TextualBodyViewSnapshot>
            implements TextualBodyViewActions
        {
            public onEditedMarkerClick?: MouseEventHandler<HTMLButtonElement>;
            public onBodyActionClick?: MouseEventHandler<HTMLDivElement>;
            public onEmoteSenderClick?: MouseEventHandler<HTMLButtonElement>;

            public constructor(snapshot: TextualBodyViewSnapshot, actions: TextualBodyViewActions) {
                super(snapshot);
                Object.assign(this, actions);
            }
        }

        const vm = new TestTextualBodyViewModel(
            {
                kind: TextualBodyViewKind.EMOTE,
                bodyWrapper: TextualBodyViewBodyWrapperKind.ACTION,
                bodyActionAriaLabel: "Open starter link",
                showEditedMarker: true,
                editedMarkerText: "(edited)",
                editedMarkerTooltip: "Edited yesterday at 11:48",
                editedMarkerCaption: "View edit history",
                emoteSenderName: "Alice",
            },
            {
                onEditedMarkerClick,
                onBodyActionClick,
                onEmoteSenderClick,
            },
        ) as TextualBodyViewModel;

        render(<TextualBodyView vm={vm} body={<span>waves</span>} />);

        await user.click(screen.getByRole("button", { name: "Alice" }));
        await user.click(screen.getByRole("button", { name: "Open starter link" }));
        await user.click(screen.getByRole("button", { name: "(edited)" }));

        expect(onEmoteSenderClick).toHaveBeenCalledTimes(1);
        expect(onBodyActionClick).toHaveBeenCalledTimes(1);
        expect(onEditedMarkerClick).toHaveBeenCalledTimes(1);
    });
});
