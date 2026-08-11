/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { ReplyTileView } from "./ReplyTileView";
import styles from "./ReplyTileView.module.css";

describe("ReplyTileView", () => {
    it("applies host class names to the reply and sender", () => {
        const { container } = render(
            <ReplyTileView
                href="/room/event"
                sender={<span>Sender</span>}
                className="host-root"
                senderClassName="host-sender"
            >
                <span>Reply content</span>
            </ReplyTileView>,
        );

        expect(container.firstElementChild).toHaveClass("host-root");
        expect(screen.getByText("Sender").parentElement).toHaveClass("host-sender");
        expect(screen.getByRole("link")).toHaveAttribute("href", "/room/event");
        expect(screen.getByText("Sender")).toBeInTheDocument();
        expect(screen.getByText("Reply content")).toBeInTheDocument();
    });

    it("applies inline and informational modifiers", () => {
        const { container } = render(
            <ReplyTileView href="#" inline info>
                Reply content
            </ReplyTileView>,
        );

        expect(container.firstElementChild).toHaveClass(styles.root, styles.inline, styles.info);
    });

    it("clips production-shaped event content to the reply preview", () => {
        const { container } = render(
            <ReplyTileView href="#">
                <div className="mx_EventTile_content">Long reply content</div>
            </ReplyTileView>,
        );

        const content = container.querySelector<HTMLElement>(".mx_EventTile_content");
        expect(content).not.toBeNull();
        expect(getComputedStyle(content!).overflow).toBe("hidden");
    });

    it("passes clicks to the reply action", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        render(
            <ReplyTileView href="#" onClick={onClick}>
                Reply content
            </ReplyTileView>,
        );

        await user.click(screen.getByRole("link"));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
