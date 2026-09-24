/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { initOnce } from "@vector-im/matrix-wysiwyg";
import { flushPromises } from "test-utils";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { SendWysiwygComposer } from ".";
import { aboveLeftOf } from "../../../structures/ContextMenu";
import { type ComposerInsertPayload, ComposerType } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { setSelection } from "./utils/selection";
import { createMocks } from "./__mocks__";
import { ScopedRoomContextProvider } from "../../../../contexts/ScopedRoomContext.tsx";
import { E2EStatus } from "../../../../utils/ShieldUtils.ts";
import { RoomUploadContextProvider } from "../../../../viewmodels/room/RoomUploadViewModel.tsx";

vi.mock("../EmojiButton", () => ({
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
        vi.resetAllMocks();
    });

    const { defaultRoomContext, mockClient } = createMocks();

    const registerId = defaultDispatcher.register((payload) => {
        switch (payload.action) {
            case Action.ComposerInsert: {
                const insertPayload = payload as ComposerInsertPayload;
                if (insertPayload.composerType) break;

                // re-dispatch to the correct composer
                defaultDispatcher.dispatch<ComposerInsertPayload>({
                    ...insertPayload,
                    timelineRenderingType: insertPayload.timelineRenderingType!,
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
        e2eStatus?: E2EStatus,
    ) => {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...defaultRoomContext}>
                    <RoomUploadContextProvider>
                        <SendWysiwygComposer
                            onChange={onChange}
                            onSend={onSend}
                            disabled={disabled}
                            isRichTextEnabled={isRichTextEnabled}
                            menuPosition={aboveLeftOf({ top: 0, bottom: 0, right: 0 })}
                            placeholder={placeholder}
                            e2eStatus={e2eStatus}
                        />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
        );
    };

    it("Should render WysiwygComposer when isRichTextEnabled is at true", async () => {
        // When
        customRender(vi.fn(), vi.fn(), false, true);

        // Then
        expect(await screen.findByTestId("WysiwygComposer", undefined, { timeout: 5000 })).toBeInTheDocument();
    });

    it("Should render PlainTextComposer when isRichTextEnabled is at false", async () => {
        // When
        customRender(vi.fn(), vi.fn(), false, false);

        // Then
        expect(await screen.findByTestId("PlainTextComposer")).toBeInTheDocument();
    });

    describe.each([{ isRichTextEnabled: true }, { isRichTextEnabled: false }])(
        "Should focus when receiving an Action.FocusSendMessageComposer action",
        ({ isRichTextEnabled }) => {
            afterEach(() => {
                vi.resetAllMocks();
            });

            it("Should focus when receiving an Action.FocusSendMessageComposer action", async () => {
                // Given we don't have focus
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled);
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
                const onChange = vi.fn();
                customRender(onChange, vi.fn(), false, isRichTextEnabled);
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
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled);
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
                customRender(vi.fn(), vi.fn(), true, isRichTextEnabled);
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
                vi.resetAllMocks();
            });

            it("Should not has placeholder", async () => {
                // When
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // Then
                expect(screen.getByRole("textbox")).not.toHaveClass("mx_WysiwygComposer_Editor_content_placeholder");
            });

            it("Should has placeholder", async () => {
                // When
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled, "my placeholder");
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));

                // Then
                expect(screen.getByRole("textbox")).toHaveClass("mx_WysiwygComposer_Editor_content_placeholder");
            });

            it("Should display or not placeholder when editor content change", async () => {
                // When
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled, "my placeholder");
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
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
                emojiButton = screen.getByLabelText("Emoji");
            });

            afterEach(() => {
                vi.resetAllMocks();
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

    describe.each([{ isRichTextEnabled: true }, { isRichTextEnabled: false }])(
        "Left icon when %s",
        ({ isRichTextEnabled }) => {
            it.each([
                [E2EStatus.Verified, "Everyone in this room is verified"],
                [E2EStatus.Warning, "Someone is using an unknown session"],
                [undefined, undefined],
            ])("Should render left icon when e2eStatus is %s", async (e2eStatus, expectedLabel) => {
                // When
                customRender(vi.fn(), vi.fn(), false, isRichTextEnabled, undefined, e2eStatus);
                await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contentEditable", "true"));
                const leftIcon = screen.getByTestId("e2e-icon");
                // Then
                expect(leftIcon).toBeInTheDocument();
                expect(leftIcon).toHaveClass("mx_E2EIcon");
                if (expectedLabel) {
                    expect(leftIcon).toHaveAccessibleName(expectedLabel);
                } else {
                    expect(leftIcon.querySelector("svg")).not.toBeInTheDocument();
                }
            });
        },
    );
});
