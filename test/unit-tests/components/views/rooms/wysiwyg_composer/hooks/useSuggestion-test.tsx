/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type React from "react";
import {
    type Suggestion,
    findSuggestionInText,
    getMappedSuggestion,
    processCommand,
    processEmojiReplacement,
    processMention,
    processSelectionChange,
} from "../../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/useSuggestion";

function createMockPlainTextSuggestionPattern(props: Partial<Suggestion> = {}): Suggestion {
    return {
        mappedSuggestion: { keyChar: "/", type: "command", text: "some text", ...props.mappedSuggestion },
        node: document.createTextNode(""),
        startOffset: 0,
        endOffset: 0,
        ...props,
    };
}

function createMockCustomSuggestionPattern(props: Partial<Suggestion> = {}): Suggestion {
    return {
        mappedSuggestion: { keyChar: "", type: "custom", text: "🙂", ...props.mappedSuggestion },
        node: document.createTextNode(":)"),
        startOffset: 0,
        endOffset: 2,
        ...props,
    };
}

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

describe("processEmojiReplacement", () => {
    it("does not change parent hook state if suggestion is null", () => {
        // create a mockSuggestion using the text node above
        const mockSetSuggestion = jest.fn();
        const mockSetText = jest.fn();

        // call the function with a null suggestion
        processEmojiReplacement(null, mockSetSuggestion, mockSetText);

        // check that the parent state setter has not been called
        expect(mockSetText).not.toHaveBeenCalled();
    });

    it("can change the parent hook state when required", () => {
        // create a div and append a text node to it with some initial text
        const editorDiv = document.createElement("div");
        const initialText = ":)";
        const textNode = document.createTextNode(initialText);
        editorDiv.appendChild(textNode);

        // create a mockSuggestion using the text node above
        const mockSuggestion = createMockCustomSuggestionPattern({ node: textNode });
        const mockSetSuggestion = jest.fn();
        const mockSetText = jest.fn();
        const replacementText = "🙂";

        processEmojiReplacement(mockSuggestion, mockSetSuggestion, mockSetText);

        // check that the text has changed and includes a trailing space
        expect(mockSetText).toHaveBeenCalledWith(replacementText);
    });
});

describe("processMention", () => {
    // TODO refactor and expand tests when mentions become <a> tags
    it("returns early when suggestion is null", () => {
        const mockSetSuggestion = jest.fn();
        const mockSetText = jest.fn();
        processMention("href", "displayName", new Map(), null, mockSetSuggestion, mockSetText);

        expect(mockSetSuggestion).not.toHaveBeenCalled();
        expect(mockSetText).not.toHaveBeenCalled();
    });

    it("can insert a mention into a text node", () => {
        // make a text node and an editor div, set the cursor inside the text node and then
        // append node to editor, then editor to document
        const textNode = document.createTextNode("@a");
        const mockEditor = document.createElement("div");
        mockEditor.appendChild(textNode);
        document.body.appendChild(mockEditor);
        document.getSelection()?.setBaseAndExtent(textNode, 1, textNode, 1);

        // call the util function
        const href = "href";
        const displayName = "displayName";
        const mockSetSuggestionData = jest.fn();
        const mockSetText = jest.fn();
        processMention(
            href,
            displayName,
            new Map([["style", "test"]]),
            { node: textNode, startOffset: 0, endOffset: 2 } as unknown as Suggestion,
            mockSetSuggestionData,
            mockSetText,
        );

        // check that the editor has a single child
        expect(mockEditor.children).toHaveLength(1);
        const linkElement = mockEditor.firstElementChild as HTMLElement;

        // and that the child is an <a> tag with the expected attributes and content
        expect(linkElement).toBeInstanceOf(HTMLAnchorElement);
        expect(linkElement).toHaveAttribute(href, href);
        expect(linkElement).toHaveAttribute("contenteditable", "false");
        expect(linkElement).toHaveAttribute("style", "test");
        expect(linkElement.textContent).toBe(displayName);

        expect(mockSetText).toHaveBeenCalledWith();
        expect(mockSetSuggestionData).toHaveBeenCalledWith(null);
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

        processSelectionChange(mockEditorRef, jest.fn());
        expect(nodeIteratorSpy).not.toHaveBeenCalled();

        // tidy up to avoid potential impacts on other tests
        nodeIteratorSpy.mockRestore();
    });

    it("calls setSuggestion with null if selection is not a cursor", () => {
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has different start and end locations ie it
        // is not a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, 4);

        // process the selection and check that we do not attempt to set the suggestion
        processSelectionChange(mockEditorRef, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith(null);
    });

    it("calls setSuggestion with null if selection cursor is not inside a text node", () => {
        const [mockEditor] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection that points at the editor element, not the text node it contains
        document.getSelection()?.setBaseAndExtent(mockEditor, 0, mockEditor, 0);

        // process the selection and check that we do not attempt to set the suggestion
        processSelectionChange(mockEditorRef, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith(null);
    });

    it("calls setSuggestion with null if we have an existing suggestion but no command match", () => {
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining("content");
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has identical start and end locations, ie it is a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, 0);

        // the call to process the selection will have an existing suggestion in state due to the second
        // argument being non-null, expect that we clear this suggestion now that the text is not a command
        processSelectionChange(mockEditorRef, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith(null);
    });

    it("calls setSuggestion with the expected arguments when text node is valid command", () => {
        const commandText = "/potentialCommand";
        const [mockEditor, textNode] = appendEditorWithTextNodeContaining(commandText);
        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has identical start and end locations, ie it is a cursor
        document.getSelection()?.setBaseAndExtent(textNode, 3, textNode, 3);

        // process the change and check the suggestion that is set looks as we expect it to
        processSelectionChange(mockEditorRef, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith({
            mappedSuggestion: {
                keyChar: "/",
                type: "command",
                text: "potentialCommand",
            },
            node: textNode,
            startOffset: 0,
            endOffset: commandText.length,
        });
    });

    it("does not treat a command outside the first text node to be a suggestion", () => {
        const [mockEditor] = appendEditorWithTextNodeContaining("some text in first node");
        const [, commandTextNode] = appendEditorWithTextNodeContaining("/potentialCommand");

        const mockEditorRef = createMockEditorRef(mockEditor);

        // create a selection in the text node that has identical start and end locations, ie it is a cursor
        document.getSelection()?.setBaseAndExtent(commandTextNode, 3, commandTextNode, 3);

        // process the change and check the suggestion that is set looks as we expect it to
        processSelectionChange(mockEditorRef, mockSetSuggestion);
        expect(mockSetSuggestion).toHaveBeenCalledWith(null);
    });
});

describe("findSuggestionInText", () => {
    const command = "/someCommand";
    const userMention = "@userMention";
    const roomMention = "#roomMention";

    const mentionTestCases = [userMention, roomMention];
    const allTestCases = [command, userMention, roomMention];

    it("returns null if content does not contain any mention or command characters", () => {
        expect(findSuggestionInText("hello", 1, true)).toBeNull();
    });

    it("returns null if content contains a command but is not the first text node", () => {
        expect(findSuggestionInText(command, 1, false)).toBeNull();
    });

    it("returns null if the offset is outside the content length", () => {
        expect(findSuggestionInText("hi", 30, true)).toBeNull();
        expect(findSuggestionInText("hi", -10, true)).toBeNull();
    });

    it.each(allTestCases)("returns an object when the whole input is special case: %s", (text) => {
        const expected = {
            mappedSuggestion: getMappedSuggestion(text),
            startOffset: 0,
            endOffset: text.length,
        };
        // test for cursor immediately before and after special character, before end, at end
        expect(findSuggestionInText(text, 0, true)).toEqual(expected);
        expect(findSuggestionInText(text, 1, true)).toEqual(expected);
        expect(findSuggestionInText(text, text.length - 2, true)).toEqual(expected);
        expect(findSuggestionInText(text, text.length, true)).toEqual(expected);
    });

    it("returns null when a command is followed by other text", () => {
        const followingText = " followed by something";

        // check for cursor inside and outside the command
        expect(findSuggestionInText(command + followingText, command.length - 2, true)).toBeNull();
        expect(findSuggestionInText(command + followingText, command.length + 2, true)).toBeNull();
    });

    it.each(mentionTestCases)("returns an object when a %s is followed by other text", (mention) => {
        const followingText = " followed by something else";
        expect(findSuggestionInText(mention + followingText, mention.length - 2, true)).toEqual({
            mappedSuggestion: getMappedSuggestion(mention),
            startOffset: 0,
            endOffset: mention.length,
        });
    });

    it("returns null if there is a command surrounded by text", () => {
        const precedingText = "text before the command ";
        const followingText = " text after the command";
        expect(
            findSuggestionInText(precedingText + command + followingText, precedingText.length + 4, true),
        ).toBeNull();
    });

    it.each(mentionTestCases)("returns an object if %s is surrounded by text", (mention) => {
        const precedingText = "I want to mention ";
        const followingText = " in my message";

        const textInput = precedingText + mention + followingText;
        const expected = {
            mappedSuggestion: getMappedSuggestion(mention),
            startOffset: precedingText.length,
            endOffset: precedingText.length + mention.length,
        };

        // when the cursor is immediately before the special character
        expect(findSuggestionInText(textInput, precedingText.length, true)).toEqual(expected);
        // when the cursor is inside the mention
        expect(findSuggestionInText(textInput, precedingText.length + 3, true)).toEqual(expected);
        // when the cursor is right at the end of the mention
        expect(findSuggestionInText(textInput, precedingText.length + mention.length, true)).toEqual(expected);
    });

    it("returns null for text content with an email address", () => {
        const emailInput = "send to user@test.com";
        expect(findSuggestionInText(emailInput, 15, true)).toBeNull();
    });

    it("returns null for double slashed command", () => {
        const doubleSlashCommand = "//not a command";
        expect(findSuggestionInText(doubleSlashCommand, 4, true)).toBeNull();
    });

    it("returns null for slash separated text", () => {
        const slashSeparatedInput = "please to this/that/the other";
        expect(findSuggestionInText(slashSeparatedInput, 21, true)).toBeNull();
    });

    it("returns an object for a mention that contains punctuation", () => {
        const mentionWithPunctuation = "@userX14#5a_-";
        const precedingText = "mention ";
        const mentionInput = precedingText + mentionWithPunctuation;
        expect(findSuggestionInText(mentionInput, 12, true)).toEqual({
            mappedSuggestion: getMappedSuggestion(mentionWithPunctuation),
            startOffset: precedingText.length,
            endOffset: precedingText.length + mentionWithPunctuation.length,
        });
    });

    it("returns null when user inputs any whitespace after the special character", () => {
        const mentionWithSpaceAfter = "@ somebody";
        expect(findSuggestionInText(mentionWithSpaceAfter, 2, true)).toBeNull();
    });

    it("returns an object for an emoji suggestion", () => {
        const emoiticon = ":)";
        const precedingText = "hello ";
        const mentionInput = precedingText + emoiticon;
        expect(findSuggestionInText(mentionInput, precedingText.length, true, true)).toEqual({
            mappedSuggestion: getMappedSuggestion(emoiticon, true),
            startOffset: precedingText.length,
            endOffset: precedingText.length + emoiticon.length,
        });
    });
});

describe("getMappedSuggestion", () => {
    it("returns null when the first character is not / # @", () => {
        expect(getMappedSuggestion("Zzz")).toBe(null);
    });

    it("returns the expected mapped suggestion when first character is # or @", () => {
        expect(getMappedSuggestion("@user-mention")).toEqual({
            type: "mention",
            keyChar: "@",
            text: "user-mention",
        });
        expect(getMappedSuggestion("#room-mention")).toEqual({
            type: "mention",
            keyChar: "#",
            text: "room-mention",
        });
    });

    it("returns the expected mapped suggestion when first character is /", () => {
        expect(getMappedSuggestion("/command")).toEqual({
            type: "command",
            keyChar: "/",
            text: "command",
        });
    });

    it("returns the expected mapped suggestion when the text is a plain text emoiticon", () => {
        expect(getMappedSuggestion(":)", true)).toEqual({
            type: "custom",
            keyChar: "",
            text: "🙂",
        });
    });
});
