/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {
    Suggestion,
    mapSuggestion,
    processCommand,
    processSelectionChange,
} from "../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/useSuggestion";

function createMockPlainTextSuggestionPattern(props: Partial<Suggestion> = {}): Suggestion {
    return {
        keyChar: "/",
        type: "command",
        text: "some text",
        node: document.createTextNode(""),
        startOffset: 0,
        endOffset: 0,
        ...props,
    };
}

describe("mapSuggestion", () => {
    it("returns null if called with a null argument", () => {
        expect(mapSuggestion(null)).toBeNull();
    });

    it("returns a mapped suggestion when passed a suggestion", () => {
        const inputFields = {
            keyChar: "/" as const,
            type: "command" as const,
            text: "some text",
        };
        const input = createMockPlainTextSuggestionPattern(inputFields);
        const output = mapSuggestion(input);

        expect(output).toEqual(inputFields);
    });
});

describe("processCommand", () => {
    it("does not change parent hook state if suggestion is null", () => {
        // create a mockSuggestion using the text node above
        const mockSetSuggestion = jest.fn();
        const mockSetText = jest.fn();

        // call the function with a null suggestion
        processCommand("should not be seen", null, mockSetSuggestion, mockSetText);

        // check that the parent state setter has not been called
        expect(mockSetText).not.toHaveBeenCalled();
    });

    it("can change the parent hook state when required", () => {
        // create a div and append a text node to it with some initial text
        const editorDiv = document.createElement("div");
        const initialText = "text";
        const textNode = document.createTextNode(initialText);
        editorDiv.appendChild(textNode);

        // create a mockSuggestion using the text node above
        const mockSuggestion = createMockPlainTextSuggestionPattern({ node: textNode });
        const mockSetSuggestion = jest.fn();
        const mockSetText = jest.fn();
        const replacementText = "/replacement text";

        processCommand(replacementText, mockSuggestion, mockSetSuggestion, mockSetText);

        // check that the text has changed and includes a trailing space
        expect(mockSetText).toHaveBeenCalledWith(`${replacementText} `);
    });
});

describe("processSelectionChange", () => {
    function createMockEditorRef(element: HTMLDivElement | null = null): React.RefObject<HTMLDivElement> {
        return { current: element } as React.RefObject<HTMLDivElement>;
    }

    function appendEditorWithTextNodeContaining(initialText = ""): [HTMLDivElement, Node] {
        // create the elements/nodes
        const mockEditor = document.createElement("div");
        const textNode = document.createTextNode(initialText);

        // append text node to the editor, editor to the document body
        mockEditor.appendChild(textNode);
        document.body.appendChild(mockEditor);

        return [mockEditor, textNode];
    }

    const mockSetSuggestion = jest.fn();
    beforeEach(() => {
        mockSetSuggestion.mockClear();
    });

    it("returns early if current editorRef is null", () => {
        const mockEditorRef = createMockEditorRef(null);
        // we monitor for the call to document.createNodeIterator to indicate an early return
        const nodeIteratorSpy = jest.spyOn(document, "createNodeIterator");

        processSelectionChange(mockEditorRef, null, jest.fn());
        expect(nodeIteratorSpy).not.toHaveBeenCalled();

        // tidy up to avoid potential impacts on other tests
        nodeIteratorSpy.mockRestore();
    });

    it("does not call setSuggestion if selection is not a cursor", () => {
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has different start and end locations ie it
        // is not a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, 4);

        // process the selection and check that we do not attempt to set the suggestion
        processSelectionChange(mockEditorRef, createMockPlainTextSuggestionPattern(), mockSetSuggestion);
        expect(mockSetSuggestion).not.toHaveBeenCalled();
    });

    it("does not call setSuggestion if selection cursor is not inside a text node", () => {
        const [mockEditor] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection that points at the editor element, not the text node it contains
        document.getSelection()?.setBaseAndExtent(mockEditor, 0, mockEditor, 0);

        // process the selection and check that we do not attempt to set the suggestion
        processSelectionChange(mockEditorRef, createMockPlainTextSuggestionPattern(), mockSetSuggestion);
        expect(mockSetSuggestion).not.toHaveBeenCalled();
    });

    it("calls setSuggestion with null if we have an existing suggestion but no command match", () => {
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has identical start and end locations, ie it is a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, 0);

        // the call to process the selection will have an existing suggestion in state due to the second
        // argument being non-null, expect that we clear this suggestion now that the text is not a command
        processSelectionChange(mockEditorRef, createMockPlainTextSuggestionPattern(), mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith(null);
    });

    it("calls setSuggestion with the expected arguments when text node is valid command", () => {
        const commandText = "/potentialCommand";
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining(commandText);
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has identical start and end locations, ie it is a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 3, textNode, 3);

        // process the change and check the suggestion that is set looks as we expect it to
        processSelectionChange(mockEditorRef, null, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith({
            keyChar: "/",
            type: "command",
            text: "potentialCommand",
            node: textNode,
            startOffset: 0,
            endOffset: commandText.length,
        });
    });
});
