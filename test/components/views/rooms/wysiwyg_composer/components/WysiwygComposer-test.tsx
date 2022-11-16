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

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { WysiwygComposer }
    from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/WysiwygComposer";
import SettingsStore from "../../../../../../src/settings/SettingsStore";

describe('WysiwygComposer', () => {
    const customRender = (
        onChange = (_content: string) => void 0,
        onSend = () => void 0,
        disabled = false,
        initialContent?: string) => {
        return render(
            <WysiwygComposer onChange={onChange} onSend={onSend} disabled={disabled} initialContent={initialContent} />,
        );
    };

    it('Should have contentEditable at false when disabled', () => {
        // When
        customRender(jest.fn(), jest.fn(), true);

        // Then
        expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "false");
    });

    describe('Standard behavior', () => {
        const onChange = jest.fn();
        const onSend = jest.fn();
        beforeEach(async () => {
            customRender(onChange, onSend);
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));
        });

        afterEach(() => {
            onChange.mockReset();
            onSend.mockReset();
        });

        it('Should have contentEditable at true', async () => {
            // Then
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));
        });

        it('Should have focus', async () => {
            // Then
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
        });

        it('Should call onChange handler', async () => {
            // When
            fireEvent.input(screen.getByRole('textbox'), {
                data: 'foo bar',
                inputType: 'insertText',
            });

            // Then
            await waitFor(() => expect(onChange).toBeCalledWith('foo bar'));
        });

        it('Should call onSend when Enter is pressed ', async () => {
        //When
            fireEvent(screen.getByRole('textbox'), new InputEvent('input', {
                inputType: "insertParagraph",
            }));

            // Then it sends a message
            await waitFor(() => expect(onSend).toBeCalledTimes(1));
        });
    });

    describe('When settings require Ctrl+Enter to send', () => {
        const onChange = jest.fn();
        const onSend = jest.fn();
        beforeEach(async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                if (name === "MessageComposerInput.ctrlEnterToSend") return true;
            });
            customRender(onChange, onSend);
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveAttribute('contentEditable', "true"));
        });

        afterEach(() => {
            onChange.mockReset();
            onSend.mockReset();
        });

        it('Should not call onSend when Enter is pressed', async () => {
            // When
            fireEvent(screen.getByRole('textbox'), new InputEvent('input', {
                inputType: "insertParagraph",
            }));

            // Then it does not send a message
            await waitFor(() => expect(onSend).toBeCalledTimes(0));
        });

        it('Should send a message when Ctrl+Enter is pressed', async () => {
            // When
            fireEvent(screen.getByRole('textbox'), new InputEvent('input', {
                inputType: "sendMessage",
            }));

            // Then it sends a message
            await waitFor(() => expect(onSend).toBeCalledTimes(1));
        });
    });
});

