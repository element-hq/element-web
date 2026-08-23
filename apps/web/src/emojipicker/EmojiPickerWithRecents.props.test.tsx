/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { type EmojiPickerProps } from "@element-hq/web-shared-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";

import { KeyBindingAction } from "../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../KeyBindingsManager";
import { EmojiPickerWithRecents } from "./EmojiPickerWithRecents";
import * as recent from "./recent";

const emojiPickerSpy = vi.hoisted(() => vi.fn<(props: EmojiPickerProps) => void>());

vi.mock("@element-hq/web-shared-components", async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    const React = await import("react");

    return {
        ...actual,
        EmojiPicker: (props: EmojiPickerProps): React.ReactNode => {
            emojiPickerSpy(props);
            return React.createElement(
                "div",
                { role: "row" },
                Array.from({ length: props.emojisPerRow ?? 0 }, (_, index) =>
                    React.createElement("div", { key: index, role: "gridcell" }),
                ),
            );
        },
    };
});

describe("EmojiPickerWithRecents host props", () => {
    beforeEach(() => {
        emojiPickerSpy.mockClear();
        vi.spyOn(recent, "get").mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("passes consumer props through while locking the Ashram host policy", () => {
        const selectedEmojis = new Set(["🎉"]);
        const isEmojiDisabled = vi.fn(() => false);
        const onChoose = vi.fn(() => true);
        const onFinished = vi.fn();

        render(
            <EmojiPickerWithRecents
                selectedEmojis={selectedEmojis}
                isEmojiDisabled={isEmojiDisabled}
                onChoose={onChoose}
                onFinished={onFinished}
            />,
        );

        const props = emojiPickerSpy.mock.lastCall![0];
        expect(props).toMatchObject({
            selectedEmojis,
            isEmojiDisabled,
            onChoose,
            onFinished,
            className: "mx_EmojiPickerWithRecents",
            emojisPerRow: 11,
            emojiRowHeight: 52,
            categoryOrientation: "vertical",
            previewFallbackEmoji: "😀",
            showQuickReactions: true,
            onRecordRecent: recent.add,
        });
        expect(screen.getAllByRole("gridcell")).toHaveLength(11);
    });

    it("passes the first resolvable ordered recent emoji as the Preview fallback", () => {
        vi.mocked(recent.get).mockReturnValue(["<unsupported>", "🎉", "😀"]);

        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        expect(emojiPickerSpy.mock.lastCall![0].previewFallbackEmoji).toBe("🎉");
    });

    it("passes the grinning face Preview fallback when every recent emoji is unsupported", () => {
        vi.mocked(recent.get).mockReturnValue(["<unsupported>"]);

        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);

        expect(emojiPickerSpy.mock.lastCall![0].previewFallbackEmoji).toBe("😀");
    });

    it("resolves roving actions through the app keybinding manager", () => {
        const getAccessibilityAction = vi
            .spyOn(getKeyBindingsManager(), "getAccessibilityAction")
            .mockReturnValue(KeyBindingAction.ArrowRight);

        render(<EmojiPickerWithRecents onChoose={() => true} onFinished={vi.fn()} />);
        const getAction = emojiPickerSpy.mock.lastCall![0].getAction;
        const action = getAction!({ key: "ArrowRight" } as React.KeyboardEvent);

        expect(getAccessibilityAction).toHaveBeenCalled();
        expect(action).toBeDefined();
    });
});
