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

import React from 'react';
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlainTextComposer }
    from "../../../../../../src/components/views/rooms/wysiwyg_composer/components/PlainTextComposer";

// Work around missing ClipboardEvent type
class MyClipboardEvent {}
window.ClipboardEvent = MyClipboardEvent as any;

describe('PlainTextComposer', () => {
    const customRender = (
        onChange = (_content: string) => void 0,
        onSend = () => void 0,
        disabled = false,
        initialContent?: string) => {
        return render(
            <PlainTextComposer onChange={onChange} onSend={onSend} disabled={disabled} initialContent={initialContent} />,
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

    it('Should call onChange handler', async () => {
        // When
        const content = 'content';
        const onChange = jest.fn();
        customRender(onChange, jest.fn());
        await userEvent.type(screen.getByRole('textbox'), content);

        // Then
        expect(onChange).toBeCalledWith(content);
    });

    it('Should call onSend when Enter is pressed', async () => {
        //When
        const onSend = jest.fn();
        customRender(jest.fn(), onSend);
        await userEvent.type(screen.getByRole('textbox'), '{enter}');

        // Then it sends a message
        expect(onSend).toBeCalledTimes(1);
    });

    it('Should clear textbox content when clear is called', async () => {
        //When
        let composer;
        render(
            <PlainTextComposer onChange={jest.fn()} onSend={jest.fn()}>
                { (ref, composerFunctions) => {
                    composer = composerFunctions;
                    return null;
                } }
            </PlainTextComposer>,
        );
        await userEvent.type(screen.getByRole('textbox'), 'content');
        expect(screen.getByRole('textbox').innerHTML).toBe('content');
        composer.clear();

        // Then
        expect(screen.getByRole('textbox').innerHTML).toBeFalsy();
    });
});
