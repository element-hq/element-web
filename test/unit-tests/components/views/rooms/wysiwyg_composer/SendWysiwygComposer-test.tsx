/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../../src/dispatcher/actions";
import { flushPromises } from "../../../../../test-utils";
import { SendWysiwygComposer } from "../../../../../../src/components/views/rooms/wysiwyg_composer/";
import { aboveLeftOf } from "../../../../../../src/components/structures/ContextMenu";
import {
    type ComposerInsertPayload,
    ComposerType,
} from "../../../../../../src/dispatcher/payloads/ComposerInsertPayload";
import { setSelection } from "../../../../../../src/components/views/rooms/wysiwyg_composer/utils/selection";
import { createMocks } from "./utils";
import { ScopedRoomContextProvider } from "../../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../../src/components/views/rooms/EmojiButton", () => ({
    EmojiButton: ({ addEmoji }: { addEmoji: (emoji: string) => void }) => {
        return (
            <button aria-label="Emoji" type="button" onClick={() => addEmoji("🦫")}>
                Emoji
            </button>
        );
    },
}));

beforeAll(initOnce, 10000);

describe("SendWysiwygComposer", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    const { defaultRoomContext, mockClient } = createMocks();

    const registerId = defaultDispatcher.register((payload) => {
        switch (payload.action) {
            case Action.ComposerInsert: {
                if (payload.composerType) break;

                // re-dispatch to the correct composer
                defaultDispatcher.dispatch<ComposerInsertPayload>({
                    ...(payload as ComposerInsertPayload),
                    composerType: ComposerType.Send,
                });
                break;
            }
        }
    });

    afterAll(() => {
        defaultDispatcher.unregister(registerId);
    });

    const customRender = (
        onChange = (_content: string): void => void 0,
        onSend = (): void => void 0,
        disabled = false,
        isRichTextEnabled = true,
        placeholder?: string,
    ) => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext}>
                    <SendWysiwygComposer
                        onChange={onChange}
                        onSend={onSend}
                        disabled={disabled}
                        isRichTextEnabled={isRichTextEnabled}
                        menuPosition={aboveLeftOf({ top: 0, bottom: 0, right: 0 })}
                        placeholder={placeholder}
                    />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    };

    it("Should render WysiwygComposer when isRichTextEnabled is at true", async () => {
        // When
        customRender(jest.fn(), jest.fn(), false, true);

        // Then
        expect(await screen.findByTestId("WysiwygComposer", undefined, { timeout: 5000 })).toBeInTheDocument();
    });

    it("Should render PlainTextComposer when isRichTextEnabled is at false", async () => {
        // When
        customRender(jest.fn(), jest.fn(), false, false);

        // Then
        expect(await screen.findByTestId("PlainTextComposer")).toBeInTheDocument();
    });

    describe.each([{ isRichTextEnabled: true }, { isRichTextEnabled: false }])(
        "Should focus when receiving an Action.FocusSendMessageComposer action",
        ({ isRichTextEnabled }) => {
            afterEach(() => {
                jest.resetAllMocks();
            });

            it("Should focus when receiving an Action.FocusSendMessageComposer action", async () => {
                // Given we don't have focus
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // When we send the right action
                defaultDispatcher.dispatch({
                    action: Action.FocusSendMessageComposer,
                    context: null,
                });

                // Then the component gets the focus
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
            });

            it("Should focus and clear when receiving an Action.ClearAndFocusSendMessageComposer", async () => {
                // Given we don't have focus
                const onChange = jest.fn();
                customRender(onChange, jest.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                fireEvent.input(screen.getByRole("textbox"), {
                    data: "foo bar",
                    inputType: "insertText",
                });

                // When we send the right action
                defaultDispatcher.dispatch({
                    action: Action.ClearAndFocusSendMessageComposer,
                    timelineRenderingType: defaultRoomContext.timelineRenderingType,
                });

                // Then the component gets the focus
                await waitFor(() => {
                    expect(screen.getByRole("textbox")).toHaveTextContent(/^$/);
                    expect(screen.getByRole("textbox")).toHaveFocus();
                });
            });

            it("Should focus when receiving a reply_to_event action", async () => {
                // Given we don't have focus
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // When we send the right action
                defaultDispatcher.dispatch({
                    action: "reply_to_event",
                    context: null,
                });

                // Then the component gets the focus
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
            });

            it("Should not focus when disabled", async () => {
                // Given we don't have focus and we are disabled
                customRender(jest.fn(), jest.fn(), true, isRichTextEnabled);
                expect(screen.getByRole("textbox")).not.toHaveFocus();

                // When we send an action that would cause us to get focus
                defaultDispatcher.dispatch({
                    action: Action.FocusSendMessageComposer,
                    context: null,
                });
                // (Send a second event to exercise the clearTimeout logic)
                defaultDispatcher.dispatch({
                    action: Action.FocusSendMessageComposer,
                    context: null,
                });

                // Wait for event dispatch to happen
                await act(async () => {
                    await flushPromises();
                });

                // Then we don't get it because we are disabled
                expect(screen.getByRole("textbox")).not.toHaveFocus();
            });
        },
    );

    describe.each([{ isRichTextEnabled: true }, { isRichTextEnabled: false }])(
        "Placeholder when %s",
        ({ isRichTextEnabled }) => {
            afterEach(() => {
                jest.resetAllMocks();
            });

            it("Should not has placeholder", async () => {
                // When
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // Then
                expect(screen.getByRole("textbox")).not.toHaveClass("mx_WysiwygComposer_Editor_content_placeholder");
            });

            it("Should has placeholder", async () => {
                // When
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled, "my placeholder");
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // Then
                expect(screen.getByRole("textbox")).toHaveClass("mx_WysiwygComposer_Editor_content_placeholder");
            });

            it("Should display or not placeholder when editor content change", async () => {
                // When
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled, "my placeholder");
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
                screen.getByRole("textbox").innerHTML = "f";
                fireEvent.input(screen.getByRole("textbox"), {
                    data: "f",
                    inputType: "insertText",
                });

                // Then
                await waitFor(() =>
                    expect(screen.getByRole("textbox")).not.toHaveClass(
                        "mx_WysiwygComposer_Editor_content_placeholder",
                    ),
                );

                // When
                screen.getByRole("textbox").innerHTML = "";
                fireEvent.input(screen.getByRole("textbox"), {
                    inputType: "deleteContentBackward",
                });

                // Then
                await waitFor(() =>
                    expect(screen.getByRole("textbox")).toHaveClass("mx_WysiwygComposer_Editor_content_placeholder"),
                );
            });
        },
    );

    describe.each([{ isRichTextEnabled: true }, { isRichTextEnabled: false }])(
        "Emoji when %s",
        ({ isRichTextEnabled }) => {
            let emojiButton: HTMLElement;

            beforeEach(async () => {
                customRender(jest.fn(), jest.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
                emojiButton = screen.getByLabelText("Emoji");
            });

            afterEach(() => {
                jest.resetAllMocks();
            });

            it("Should add an emoji in an empty composer", async () => {
                // When
                emojiButton.click();

                // Then
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/🦫/));
            });

            it("Should add an emoji in the middle of a word", async () => {
                // When
                screen.getByRole("textbox").focus();
                screen.getByRole("textbox").innerHTML = "word";
                fireEvent.input(screen.getByRole("textbox"), {
                    data: "word",
                    inputType: "insertText",
                });

                const textNode = screen.getByRole("textbox").firstChild;
                await setSelection({
                    anchorNode: textNode,
                    anchorOffset: 2,
                    focusNode: textNode,
                    focusOffset: 2,
                    isForward: true,
                });
                // the event is not automatically fired by jest
                document.dispatchEvent(new CustomEvent("selectionchange"));

                emojiButton.click();

                // Then
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/wo🦫rd/));
            });

            it("Should add an emoji when a word is selected", async () => {
                // When
                screen.getByRole("textbox").focus();
                screen.getByRole("textbox").innerHTML = "word";
                fireEvent.input(screen.getByRole("textbox"), {
                    data: "word",
                    inputType: "insertText",
                });

                const textNode = screen.getByRole("textbox").firstChild;
                await setSelection({
                    anchorNode: textNode,
                    anchorOffset: 3,
                    focusNode: textNode,
                    focusOffset: 2,
                    isForward: false,
                });
                // the event is not automatically fired by jest
                document.dispatchEvent(new CustomEvent("selectionchange"));

                emojiButton.click();

                // Then
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent(/wo🦫d/));
            });
        },
    );
});
