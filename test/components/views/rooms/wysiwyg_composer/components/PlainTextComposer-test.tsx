/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlainTextComposer } from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/PlainTextComposer";
import * as mockUseSettingsHook from "../../../../../../src/hooks/useSettings";
import * as mockKeyboard from "../../../../../../src/Keyboard";
import { createMocks } from "../utils";
import RoomContext from "../../../../../../src/contexts/RoomContext";

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

    let mockUseSettingValue: jest.SpyInstance;
    beforeEach(() => {
        // defaults for these tests are:
        // ctrlEnterToSend is false
        mockUseSettingValue = jest.spyOn(mockUseSettingsHook, "useSettingValue").mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("Should have contentEditable at false when disabled", () => {
        // When
        customRender(jest.fn(), jest.fn(), true);

        // Then
        expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "false");
    });

    it("Should have focus", () => {
        // When
        customRender(jest.fn(), jest.fn(), false);

        // Then
        expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("Should call onChange handler", async () => {
        // When
        const content = "content";
        const onChange = jest.fn();
        customRender(onChange, jest.fn());
        await userEvent.type(screen.getByRole("textbox"), content);

        // Then
        expect(onChange).toHaveBeenCalledWith(content);
    });

    it("Should call onSend when Enter is pressed when ctrlEnterToSend is false", async () => {
        //When
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
        await userEvent.type(screen.getByRole("textbox"), "{enter}");

        // Then it sends a message
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("Should not call onSend when Enter is pressed when ctrlEnterToSend is true", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
        await userEvent.type(screen.getByRole("textbox"), "{enter}");

        // Then it does not send a message
        expect(onSend).toHaveBeenCalledTimes(0);
    });

    it("Should only call onSend when ctrl+enter is pressed when ctrlEnterToSend is true on windows", async () => {
        //When
        mockUseSettingValue.mockReturnValue(true);

        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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

        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
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
            <PlainTextComposer onChange={jest.fn()} onSend={jest.fn()}>
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
        let resizeHandler: ResizeObserverCallback = jest.fn();
        let editor: Element | null = null;
        jest.spyOn(global, "ResizeObserver").mockImplementation((handler) => {
            resizeHandler = handler;
            return {
                observe: (element) => {
                    editor = element;
                },
                unobserve: jest.fn(),
                disconnect: jest.fn(),
            };
        });
        jest.useFakeTimers();

        //When
        render(<PlainTextComposer onChange={jest.fn()} onSend={jest.fn()} />);

        // Then
        expect(screen.getByTestId("WysiwygComposerEditor").dataset["isExpanded"]).toBe("false");
        expect(editor).toBe(screen.getByRole("textbox"));

        // When
        resizeHandler(
            [{ contentBoxSize: [{ blockSize: 100 }] } as unknown as ResizeObserverEntry],
            {} as ResizeObserver,
        );

        act(() => {
            jest.runAllTimers();
        });

        // Then
        expect(screen.getByTestId("WysiwygComposerEditor").dataset["isExpanded"]).toBe("true");

        jest.useRealTimers();
        (global.ResizeObserver as jest.Mock).mockRestore();
    });

    it("Should not render <Autocomplete /> if not wrapped in room context", () => {
        customRender();
        expect(screen.queryByTestId("autocomplete-wrapper")).not.toBeInTheDocument();
    });

    it("Should render <Autocomplete /> if wrapped in room context", () => {
        const { defaultRoomContext } = createMocks();

        render(
            <RoomContext.Provider value={defaultRoomContext}>
                <PlainTextComposer onChange={jest.fn()} onSend={jest.fn()} disabled={false} initialContent="" />
            </RoomContext.Provider>,
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
