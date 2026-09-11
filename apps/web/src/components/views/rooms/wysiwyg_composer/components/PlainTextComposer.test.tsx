/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import React from "react";
import { act, render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import { PlainTextComposer } from "./PlainTextComposer";
import * as mockUseSettingsHook from "../../../../../hooks/useSettings";
import * as mockKeyboard from "../../../../../Keyboard";
import { createMocks } from "../__mocks__";
import { ScopedRoomContextProvider } from "../../../../../contexts/ScopedRoomContext.tsx";

beforeAll(initOnce, 10000);

describe("PlainTextComposer", () => {
    const customRender = (
        onChange = (_content: string): void => void 0,
        onSend = (): void => void 0,
        disabled = false,
        initialContent?: string,
    ) => {
        return render(
            <PlainTextComposer
                onChange={onChange}
                onSend={onSend}
                disabled={disabled}
                initialContent={initialContent}
            />,
        );
    };

    let mockUseSettingValue: MockInstance;
    beforeEach(() => {
        // defaults for these tests are:
        // ctrlEnterToSend is false
        mockUseSettingValue = vi.spyOn(mockUseSettingsHook, "useSettingValue").mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("Should have contentEditable at false when disabled", () => {
        // When
        customRender(vi.fn(), vi.fn(), true);

        // Then
        expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "false");
    });

    it("Should have focus", () => {
        // When
        customRender(vi.fn(), vi.fn(), false);

        // Then
        expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("Should call onChange handler", async () => {
        // When
        const content = "content";
        const onChange = vi.fn();
        customRender(onChange, vi.fn());
        await userEvent.type(screen.getByRole("textbox"), content);

        // Then
        expect(onChange).toHaveBeenCalledWith(content);
    });

    it("Should call onSend when Enter is pressed when ctrlEnterToSend is false", async () => {
        //When
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        await userEvent.type(screen.getByRole("textbox"), "{enter}");

        // Then it sends a message
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("Should not call onSend when Enter is pressed when ctrlEnterToSend is true", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        await userEvent.type(screen.getByRole("textbox"), "{enter}");

        // Then it does not send a message
        expect(onSend).toHaveBeenCalledTimes(0);
    });

    it("Should only call onSend when ctrl+enter is pressed when ctrlEnterToSend is true on windows", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);

        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        await userEvent.type(textBox, "hello");

        // Then it does NOT send a message on enter
        await userEvent.type(textBox, "{enter}");
        expect(onSend).toHaveBeenCalledTimes(0);

        // Then it does NOT send a message on windows+enter
        await userEvent.type(textBox, "{meta>}{enter}{meta/}");
        expect(onSend).toHaveBeenCalledTimes(0);

        // Then it does send a message on ctrl+enter
        await userEvent.type(textBox, "{control>}{enter}{control/}");
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("Should only call onSend when cmd+enter is pressed when ctrlEnterToSend is true on mac", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        Object.defineProperty(mockKeyboard, "IS_MAC", { value: true });

        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        await userEvent.type(textBox, "hello");

        // Then it does NOT send a message on enter
        await userEvent.type(textBox, "{enter}");
        expect(onSend).toHaveBeenCalledTimes(0);

        // Then it does NOT send a message on ctrl+enter
        await userEvent.type(textBox, "{control>}{enter}{control/}");
        expect(onSend).toHaveBeenCalledTimes(0);

        // Then it does send a message on cmd+enter
        await userEvent.type(textBox, "{meta>}{enter}{meta/}");
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("Should insert a newline character when shift enter is pressed when ctrlEnterToSend is false", async () => {
        //When
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        const inputWithShiftEnter = "new{Shift>}{enter}{/Shift}line";
        const expectedInnerHtml = "new\nline";

        await userEvent.click(textBox);
        await userEvent.type(textBox, inputWithShiftEnter);

        // Then it does not send a message, but inserts a newline character
        expect(onSend).toHaveBeenCalledTimes(0);
        expect(textBox.innerHTML).toBe(expectedInnerHtml);
    });

    it("Should insert a newline character when shift enter is pressed when ctrlEnterToSend is true", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        const keyboardInput = "new{Shift>}{enter}{/Shift}line";
        const expectedInnerHtml = "new\nline";

        await userEvent.click(textBox);
        await userEvent.type(textBox, keyboardInput);

        // Then it does not send a message, but inserts a newline character
        expect(onSend).toHaveBeenCalledTimes(0);
        expect(textBox.innerHTML).toBe(expectedInnerHtml);
    });

    it("Should not insert div and br tags when enter is pressed when ctrlEnterToSend is true", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        const enterThenTypeHtml = "<div>hello</div";

        await userEvent.click(textBox);
        await userEvent.type(textBox, "{enter}hello");

        // Then it does not send a message, but inserts a newline character
        expect(onSend).toHaveBeenCalledTimes(0);
        expect(textBox).not.toContainHTML(enterThenTypeHtml);
    });

    it("Should not insert div tags when enter is pressed then user types more when ctrlEnterToSend is true", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        const onSend = vi.fn();
        customRender(vi.fn(), onSend);
        const textBox = screen.getByRole("textbox");
        const defaultEnterHtml = "<div><br></div";

        await userEvent.click(textBox);
        await userEvent.type(textBox, "{enter}");

        // Then it does not send a message, but inserts a newline character
        expect(onSend).toHaveBeenCalledTimes(0);
        expect(textBox).not.toContainHTML(defaultEnterHtml);
    });

    it("Should clear textbox content when clear is called", async () => {
        //When
        let composer: {
            clear: () => void;
            insertText: (text: string) => void;
        };

        render(
            <PlainTextComposer onChange={vi.fn()} onSend={vi.fn()}>
                {(ref, composerFunctions) => {
                    composer = composerFunctions;
                    return null;
                }}
            </PlainTextComposer>,
        );

        await userEvent.type(screen.getByRole("textbox"), "content");
        expect(screen.getByRole("textbox").innerHTML).toBe("content");

        composer!.clear();

        // Then
        expect(screen.getByRole("textbox").innerHTML).toBeFalsy();
    });

    it("Should have data-is-expanded when it has two lines", async () => {
        let resizeHandler: ResizeObserverCallback = vi.fn();
        let editor: Element | null = null;
        vi.spyOn(global, "ResizeObserver").mockImplementation(function (handler) {
            resizeHandler = handler;
            return {
                observe: (element: Element) => {
                    editor = element;
                },
                unobserve: vi.fn(),
                disconnect: vi.fn(),
            } as unknown as ResizeObserver;
        });
        vi.useFakeTimers();

        //When
        render(<PlainTextComposer onChange={vi.fn()} onSend={vi.fn()} />);

        // Then
        expect(screen.getByTestId("WysiwygComposerEditor").dataset["isExpanded"]).toBe("false");
        expect(editor).toBe(screen.getByRole("textbox"));

        // When
        resizeHandler(
            [{ contentBoxSize: [{ blockSize: 100 }] } as unknown as ResizeObserverEntry],
            {} as ResizeObserver,
        );

        act(() => {
            vi.runAllTimers();
        });

        // Then
        expect(screen.getByTestId("WysiwygComposerEditor").dataset["isExpanded"]).toBe("true");

        vi.useRealTimers();
        (global.ResizeObserver as unknown as MockInstance).mockRestore();
    });

    it("Should not render <Autocomplete /> if not wrapped in room context", () => {
        customRender();
        expect(screen.queryByTestId("autocomplete-wrapper")).not.toBeInTheDocument();
    });

    it("Should render <Autocomplete /> if wrapped in room context", () => {
        const { defaultRoomContext } = createMocks();

        render(
            <ScopedRoomContextProvider {...defaultRoomContext}>
                <PlainTextComposer onChange={vi.fn()} onSend={vi.fn()} disabled={false} initialContent="" />
            </ScopedRoomContextProvider>,
        );

        expect(screen.getByTestId("autocomplete-wrapper")).toBeInTheDocument();
    });

    it("Should allow pasting of text values", async () => {
        customRender();

        const textBox = screen.getByRole("textbox");

        await userEvent.click(textBox);
        await userEvent.type(textBox, "hello");
        await userEvent.paste(" world");

        expect(textBox).toHaveTextContent("hello world");
    });
});
