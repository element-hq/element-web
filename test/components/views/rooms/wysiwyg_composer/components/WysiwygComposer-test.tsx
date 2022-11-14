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
import { render, screen } from "@testing-library/react";
import { InputEventProcessor, Wysiwyg, WysiwygProps } from "@matrix-org/matrix-wysiwyg";

import { WysiwygComposer }
    from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/WysiwygComposer";
import SettingsStore from "../../../../../../src/settings/SettingsStore";

let inputEventProcessor: InputEventProcessor | null = null;

// The wysiwyg fetch wasm bytes and a specific workaround is needed to make it works in a node (jest) environnement
// See https://github.com/matrix-org/matrix-wysiwyg/blob/main/platforms/web/test.setup.ts
jest.mock("@matrix-org/matrix-wysiwyg", () => ({
    useWysiwyg: (props: WysiwygProps) => {
        inputEventProcessor = props.inputEventProcessor ?? null;
        return {
            ref: { current: null },
            content: '<b>html</b>',
            isWysiwygReady: true,
            wysiwyg: { clear: () => void 0 },
            actionStates: {
                bold: 'enabled',
                italic: 'enabled',
                underline: 'enabled',
                strikeThrough: 'enabled',
            },
        };
    },
}));

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

    it('Should have focus', () => {
        // When
        customRender(jest.fn(), jest.fn(), false);

        // Then
        expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('Should call onChange handler', (done) => {
        const html = '<b>html</b>';
        customRender((content) => {
            expect(content).toBe((html));
            done();
        }, jest.fn());
    });

    it('Should call onSend when Enter is pressed ', () => {
        //When
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);

        // When we tell its inputEventProcessor that the user pressed Enter
        const event = new InputEvent("insertParagraph", { inputType: "insertParagraph" });
        const wysiwyg = { actions: { clear: () => {} } } as Wysiwyg;
        inputEventProcessor(event, wysiwyg);

        // Then it sends a message
        expect(onSend).toBeCalledTimes(1);
    });

    describe('When settings require Ctrl+Enter to send', () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                if (name === "MessageComposerInput.ctrlEnterToSend") return true;
            });
        });

        it('Should not call onSend when Enter is pressed', async () => {
            // Given a composer
            const onSend = jest.fn();
            customRender(() => {}, onSend, false);

            // When we tell its inputEventProcesser that the user pressed Enter
            const event = new InputEvent("input", { inputType: "insertParagraph" });
            const wysiwyg = { actions: { clear: () => {} } } as Wysiwyg;
            inputEventProcessor(event, wysiwyg);

            // Then it does not send a message
            expect(onSend).toBeCalledTimes(0);
        });

        it('Should send a message when Ctrl+Enter is pressed', async () => {
            // Given a composer
            const onSend = jest.fn();
            customRender(() => {}, onSend, false);

            // When we tell its inputEventProcesser that the user pressed Ctrl+Enter
            const event = new InputEvent("input", { inputType: "sendMessage" });
            const wysiwyg = { actions: { clear: () => {} } } as Wysiwyg;
            inputEventProcessor(event, wysiwyg);

            // Then it sends a message
            expect(onSend).toBeCalledTimes(1);
        });
    });
});

