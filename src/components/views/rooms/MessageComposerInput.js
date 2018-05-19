/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import type SyntheticKeyboardEvent from 'react/lib/SyntheticKeyboardEvent';

import { Editor } from 'slate-react';
import { getEventTransfer } from 'slate-react';
import { Value, Document, Event, Inline, Text, Range, Node } from 'slate';

import Html from 'slate-html-serializer';
import Md from 'slate-md-serializer';
import Plain from 'slate-plain-serializer';
import PlainWithPillsSerializer from "../../../autocomplete/PlainWithPillsSerializer";

// import {Editor, EditorState, RichUtils, CompositeDecorator, Modifier,
//     getDefaultKeyBinding, KeyBindingUtil, ContentState, ContentBlock, SelectionState,
//     Entity} from 'draft-js';

import classNames from 'classnames';
import escape from 'lodash/escape';
import Promise from 'bluebird';

import MatrixClientPeg from '../../../MatrixClientPeg';
import type {MatrixClient} from 'matrix-js-sdk/lib/matrix';
import SlashCommands from '../../../SlashCommands';
import { KeyCode, isOnlyCtrlOrCmdKeyEvent } from '../../../Keyboard';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t, _td } from '../../../languageHandler';
import Analytics from '../../../Analytics';

import dis from '../../../dispatcher';

import * as RichText from '../../../RichText';
import * as HtmlUtils from '../../../HtmlUtils';
import Autocomplete from './Autocomplete';
import {Completion} from "../../../autocomplete/Autocompleter";
import Markdown from '../../../Markdown';
import ComposerHistoryManager from '../../../ComposerHistoryManager';
import MessageComposerStore from '../../../stores/MessageComposerStore';

import {MATRIXTO_URL_PATTERN, MATRIXTO_MD_LINK_PATTERN} from '../../../linkify-matrix';
const REGEX_MATRIXTO = new RegExp(MATRIXTO_URL_PATTERN);
const REGEX_MATRIXTO_MARKDOWN_GLOBAL = new RegExp(MATRIXTO_MD_LINK_PATTERN, 'g');

import {asciiRegexp, unicodeRegexp, shortnameToUnicode, emojioneList, asciiList, mapUnicodeToShort, toShort} from 'emojione';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import {makeUserPermalink} from "../../../matrix-to";
import ReplyPreview from "./ReplyPreview";
import RoomViewStore from '../../../stores/RoomViewStore';
import ReplyThread from "../elements/ReplyThread";
import {ContentHelpers} from 'matrix-js-sdk';

const EMOJI_SHORTNAMES = Object.keys(emojioneList);
const EMOJI_UNICODE_TO_SHORTNAME = mapUnicodeToShort();
const REGEX_EMOJI_WHITESPACE = new RegExp('(?:^|\\s)(' + asciiRegexp + ')\\s$');
const EMOJI_REGEX = new RegExp(unicodeRegexp, 'g');

const TYPING_USER_TIMEOUT = 10000, TYPING_SERVER_TIMEOUT = 30000;

const ENTITY_TYPES = {
    AT_ROOM_PILL: 'ATROOMPILL',
};

// the Slate node type to default to for unstyled text when in RTE mode.
// (we use 'line' for oneliners however)
const DEFAULT_NODE = 'paragraph';

// map HTML elements through to our Slate schema node types
// used for the HTML deserializer.
// (The names here are chosen to match the MD serializer's schema for convenience)
const BLOCK_TAGS = {
    p: 'paragraph',
    blockquote: 'block-quote',
    ul: 'bulleted-list',
    h1: 'heading1',
    h2: 'heading2',
    h3: 'heading3',
    h4: 'heading4',
    h5: 'heading5',
    h6: 'heading6',
    li: 'list-item',
    ol: 'numbered-list',
    pre: 'code-block',
};

const MARK_TAGS = {
    strong: 'bold',
    b: 'bold', // deprecated
    em: 'italic',
    i: 'italic', // deprecated
    code: 'code',
    u: 'underlined',
    del: 'deleted',
    strike: 'deleted', // deprecated
    s: 'deleted', // deprecated
};

function onSendMessageFailed(err, room) {
    // XXX: temporary logging to try to diagnose
    // https://github.com/vector-im/riot-web/issues/3148
    console.log('MessageComposer got send failure: ' + err.name + '('+err+')');
    dis.dispatch({
        action: 'message_send_failed',
    });
}

/*
 * The textInput part of the MessageComposer
 */
export default class MessageComposerInput extends React.Component {
    static propTypes = {
        // a callback which is called when the height of the composer is
        // changed due to a change in content.
        onResize: PropTypes.func,

        // js-sdk Room object
        room: PropTypes.object.isRequired,

        // called with current plaintext content (as a string) whenever it changes
        onContentChanged: PropTypes.func,

        onFilesPasted: PropTypes.func,

        onInputStateChanged: PropTypes.func,
    };

    client: MatrixClient;
    autocomplete: Autocomplete;
    historyManager: ComposerHistoryManager;

    constructor(props, context) {
        super(props, context);

        const isRichtextEnabled = SettingsStore.getValue('MessageComposerInput.isRichTextEnabled');

        Analytics.setRichtextMode(isRichtextEnabled);

        this.state = {
            // whether we're in rich text or markdown mode
            isRichtextEnabled,

            // the currently displayed editor state (note: this is always what is modified on input)
            editorState: this.createEditorState(
                isRichtextEnabled,
                MessageComposerStore.getEditorState(this.props.room.roomId),
            ),

            // the original editor state, before we started tabbing through completions
            originalEditorState: null,

            // the virtual state "above" the history stack, the message currently being composed that
            // we want to persist whilst browsing history
            currentlyComposedEditorState: null,

            // whether there were any completions
            someCompletions: null,
        };

        this.client = MatrixClientPeg.get();

        this.plainWithMdPills    = new PlainWithPillsSerializer({ pillFormat: 'md' });
        this.plainWithIdPills    = new PlainWithPillsSerializer({ pillFormat: 'id' });
        this.plainWithPlainPills = new PlainWithPillsSerializer({ pillFormat: 'plain' });
        this.md                  = new Md();
        this.html                = new Html({
            rules: [
                {
                    deserialize: (el, next) => {
                        const tag = el.tagName.toLowerCase();
                        let type = BLOCK_TAGS[tag];
                        if (type) {
                            return {
                                object: 'block',
                                type: type,
                                nodes: next(el.childNodes),
                            }
                        }
                        type = MARK_TAGS[tag];
                        if (type) {
                            return {
                                object: 'mark',
                                type: type,
                                nodes: next(el.childNodes),
                            }
                        }
                        // special case links
                        if (tag === 'a') {
                            const href = el.getAttribute('href');
                            let m = href.match(MATRIXTO_URL_PATTERN);
                            if (m) {
                                return {
                                    object: 'inline',
                                    type: 'pill',
                                    data: { 
                                        href,
                                        completion: el.innerText,
                                        completionId: m[1],
                                    },
                                    isVoid: true,
                                }
                            }
                            else {
                                return {
                                    object: 'inline',
                                    type: 'link',
                                    data: { href },
                                    nodes: next(el.childNodes),
                                }
                            }
                        }
                    },
                    serialize: (obj, children) => {
                        if (obj.object === 'block' || obj.object === 'inline') {
                            return this.renderNode({
                                node: obj,
                                children: children,
                            });
                        }
                        else if (obj.object === 'mark') {
                            return this.renderMark({
                                mark: obj,
                                children: children,
                            });
                        }
                    }
                }
            ]
        });

        this.suppressAutoComplete = false;
        this.direction = '';
    }

    /*
     * "Does the right thing" to create an Editor value, based on:
     * - whether we've got rich text mode enabled
     * - contentState was passed in
     */
    createEditorState(richText: boolean, editorState: ?Value): Value {
        if (editorState instanceof Value) {
            return editorState;
        }
        else {
            // ...or create a new one.
            return Plain.deserialize('')
        }
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.historyManager = new ComposerHistoryManager(this.props.room.roomId);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    componentWillUpdate(nextProps, nextState) {
        // this is dirty, but moving all this state to MessageComposer is dirtier
        if (this.props.onInputStateChanged && nextState !== this.state) {
            const state = this.getSelectionInfo(nextState.editorState);
            state.isRichtextEnabled = nextState.isRichtextEnabled;
            this.props.onInputStateChanged(state);
        }
    }

    onAction = (payload) => {
        const editor = this.refs.editor;
        let editorState = this.state.editorState;

        switch (payload.action) {
            case 'reply_to_event':
            case 'focus_composer':
                editor.focus();
                break;
            case 'insert_mention':
                {
                    // Pretend that we've autocompleted this user because keeping two code
                    // paths for inserting a user pill is not fun
                    const selection = this.getSelectionRange(this.state.editorState);
                    const member = this.props.room.getMember(payload.user_id);
                    const completion = member ?
                        member.rawDisplayName.replace(' (IRC)', '') : payload.user_id;
                    this.setDisplayedCompletion({
                        completion,
                        completionId: payload.user_id,
                        selection,
                        href: makeUserPermalink(payload.user_id),
                        suffix: (selection.beginning && selection.start === 0) ? ': ' : ' ',
                    });
                }
                break;
/*
            case 'quote': { // old quoting, whilst rich quoting is in labs
                /// XXX: Not doing rich-text quoting from formatted-body because draft-js
                /// has regressed such that when links are quoted, errors are thrown. See
                /// https://github.com/vector-im/riot-web/issues/4756.
                const body = escape(payload.text);
                if (body) {
                    let content = RichText.htmlToContentState(`<blockquote>${body}</blockquote>`);
                    if (!this.state.isRichtextEnabled) {
                        content = ContentState.createFromText(RichText.stateToMarkdown(content));
                    }

                    const blockMap = content.getBlockMap();
                    let startSelection = SelectionState.createEmpty(contentState.getFirstBlock().getKey());
                    contentState = Modifier.splitBlock(contentState, startSelection);
                    startSelection = SelectionState.createEmpty(contentState.getFirstBlock().getKey());
                    contentState = Modifier.replaceWithFragment(contentState,
                        startSelection,
                        blockMap);
                    startSelection = SelectionState.createEmpty(contentState.getFirstBlock().getKey());
                    if (this.state.isRichtextEnabled) {
                        contentState = Modifier.setBlockType(contentState, startSelection, 'blockquote');
                    }
                    let editorState = EditorState.push(this.state.editorState, contentState, 'insert-characters');
                    editorState = EditorState.moveSelectionToEnd(editorState);
                    this.onEditorContentChanged(editorState);
                    editor.focus();
                }
            }
                break;
*/
        }
    };

    onTypingActivity() {
        this.isTyping = true;
        if (!this.userTypingTimer) {
            this.sendTyping(true);
        }
        this.startUserTypingTimer();
        this.startServerTypingTimer();
    }

    onFinishedTyping() {
        this.isTyping = false;
        this.sendTyping(false);
        this.stopUserTypingTimer();
        this.stopServerTypingTimer();
    }

    startUserTypingTimer() {
        this.stopUserTypingTimer();
        const self = this;
        this.userTypingTimer = setTimeout(function() {
            self.isTyping = false;
            self.sendTyping(self.isTyping);
            self.userTypingTimer = null;
        }, TYPING_USER_TIMEOUT);
    }

    stopUserTypingTimer() {
        if (this.userTypingTimer) {
            clearTimeout(this.userTypingTimer);
            this.userTypingTimer = null;
        }
    }

    startServerTypingTimer() {
        if (!this.serverTypingTimer) {
            const self = this;
            this.serverTypingTimer = setTimeout(function() {
                if (self.isTyping) {
                    self.sendTyping(self.isTyping);
                    self.startServerTypingTimer();
                }
            }, TYPING_SERVER_TIMEOUT / 2);
        }
    }

    stopServerTypingTimer() {
        if (this.serverTypingTimer) {
            clearTimeout(this.serverTypingTimer);
            this.serverTypingTimer = null;
        }
    }

    sendTyping(isTyping) {
        if (SettingsStore.getValue('dontSendTypingNotifications')) return;
        MatrixClientPeg.get().sendTyping(
            this.props.room.roomId,
            this.isTyping, TYPING_SERVER_TIMEOUT,
        ).done();
    }

    refreshTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    onChange = (change: Change, originalEditorState: value) => {

        let editorState = change.value;

        if (this.direction !== '') {
            const focusedNode = editorState.focusInline || editorState.focusText;
            if (focusedNode.isVoid) {
                if (editorState.isCollapsed) {
                    change = change[`collapseToEndOf${ this.direction }Text`]();
                }
                else {
                    const block = this.direction === 'Previous' ? editorState.previousText : editorState.nextText;
                    if (block) {
                        change = change.moveFocusToEndOf(block)
                    }
                }
                editorState = change.value;
            }
        }

        if (!editorState.document.isEmpty) {
            this.onTypingActivity();
        } else {
            this.onFinishedTyping();
        }

        /*
        // XXX: what was this ever doing?
        if (!state.hasOwnProperty('originalEditorState')) {
            state.originalEditorState = null;
        }
        */

        // emojioneify any emoji

        // XXX: is getTextsAsArray a private API?
        editorState.document.getTextsAsArray().forEach(node => {
            if (node.text !== '' && HtmlUtils.containsEmoji(node.text)) {
                let match;
                while ((match = EMOJI_REGEX.exec(node.text)) !== null) {
                    const range = Range.create({
                        anchorKey: node.key,
                        anchorOffset: match.index,
                        focusKey: node.key,
                        focusOffset: match.index + match[0].length,
                    });
                    const inline = Inline.create({
                        type: 'emoji',
                        data: { emojiUnicode: match[0] },
                        isVoid: true,
                    });
                    change = change.insertInlineAtRange(range, inline);
                    editorState = change.value;
                }
            }
        });

/*
        const currentBlock = editorState.getSelection().getStartKey();
        const currentSelection = editorState.getSelection();
        const currentStartOffset = editorState.getSelection().getStartOffset();

        const block = editorState.getCurrentContent().getBlockForKey(currentBlock);
        const text = block.getText();

        const entityBeforeCurrentOffset = block.getEntityAt(currentStartOffset - 1);
        const entityAtCurrentOffset = block.getEntityAt(currentStartOffset);

        // If the cursor is on the boundary between an entity and a non-entity and the
        // text before the cursor has whitespace at the end, set the entity state of the
        // character before the cursor (the whitespace) to null. This allows the user to
        // stop editing the link.
        if (entityBeforeCurrentOffset && !entityAtCurrentOffset &&
            /\s$/.test(text.slice(0, currentStartOffset))) {
            editorState = RichUtils.toggleLink(
                editorState,
                currentSelection.merge({
                    anchorOffset: currentStartOffset - 1,
                    focusOffset: currentStartOffset,
                }),
                null,
            );
            // Reset selection
            editorState = EditorState.forceSelection(editorState, currentSelection);
        }
*/
        if (editorState.startText !== null) {
            const text = editorState.startText.text;
            const currentStartOffset = editorState.startOffset;

            // Automatic replacement of plaintext emoji to Unicode emoji
            if (SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji')) {
                // The first matched group includes just the matched plaintext emoji
                const emojiMatch = REGEX_EMOJI_WHITESPACE.exec(text.slice(0, currentStartOffset));
                if (emojiMatch) {
                    // plaintext -> hex unicode
                    const emojiUc = asciiList[emojiMatch[1]];
                    // hex unicode -> shortname -> actual unicode
                    const unicodeEmoji = shortnameToUnicode(EMOJI_UNICODE_TO_SHORTNAME[emojiUc]);

                    const range = Range.create({
                        anchorKey: editorState.selection.startKey,
                        anchorOffset: currentStartOffset - emojiMatch[1].length - 1,
                        focusKey: editorState.selection.startKey,
                        focusOffset: currentStartOffset,
                    });
                    change = change.insertTextAtRange(range, unicodeEmoji);
                    editorState = change.value;
                }
            }
        }

        // Record the editor state for this room so that it can be retrieved after
        // switching to another room and back
        dis.dispatch({
            action: 'editor_state',
            room_id: this.props.room.roomId,
            editor_state: editorState,
        });

        /* Since a modification was made, set originalEditorState to null, since newState is now our original */
        this.setState({
            editorState,
            originalEditorState: originalEditorState || null
        });
    };

    enableRichtext(enabled: boolean) {
        if (enabled === this.state.isRichtextEnabled) return;

        // FIXME: this duplicates similar conversions which happen in the history & store.
        // they should be factored out.

        let editorState = null;
        if (enabled) {
            // for simplicity when roundtripping, we use slate-md-serializer rather than commonmark
            editorState = this.md.deserialize(this.plainWithMdPills.serialize(this.state.editorState));

            // the alternative would be something like:
            //
            // const sourceWithPills = this.plainWithMdPills.serialize(this.state.editorState);
            // const markdown = new Markdown(sourceWithPills);
            // editorState = this.html.deserialize(markdown.toHTML());

        } else {
            // let markdown = RichText.stateToMarkdown(this.state.editorState.getCurrentContent());
            // value = ContentState.createFromText(markdown);

            editorState = Plain.deserialize(this.md.serialize(this.state.editorState));
        }

        Analytics.setRichtextMode(enabled);

        this.setState({
            editorState: this.createEditorState(enabled, editorState),
            isRichtextEnabled: enabled,
        });

        SettingsStore.setValue("MessageComposerInput.isRichTextEnabled", null, SettingLevel.ACCOUNT, enabled);
    };

    /**
    * Check if the current selection has a mark with `type` in it.
    *
    * @param {String} type
    * @return {Boolean}
    */

    hasMark = type => {
        const { editorState } = this.state
        return editorState.activeMarks.some(mark => mark.type == type)
    };

    /**
    * Check if the any of the currently selected blocks are of `type`.
    *
    * @param {String} type
    * @return {Boolean}
    */

    hasBlock = type => {
        const { editorState } = this.state
        return editorState.blocks.some(node => node.type == type)
    };

    onKeyDown = (ev: Event, change: Change, editor: Editor) => {

        this.suppressAutoComplete = false;

        // skip void nodes - see
        // https://github.com/ianstormtaylor/slate/issues/762#issuecomment-304855095
        if (ev.keyCode === KeyCode.LEFT) {
            this.direction = 'Previous';
        }
        else if (ev.keyCode === KeyCode.RIGHT) {
            this.direction = 'Next';
        } else {
            this.direction = '';
        }

        if (isOnlyCtrlOrCmdKeyEvent(ev)) {
            const ctrlCmdCommand = {
                // C-m => Toggles between rich text and markdown modes
                [KeyCode.KEY_M]: 'toggle-mode',
                [KeyCode.KEY_B]: 'bold',
                [KeyCode.KEY_I]: 'italic',
                [KeyCode.KEY_U]: 'underlined',
                [KeyCode.KEY_J]: 'code',
            }[ev.keyCode];

            if (ctrlCmdCommand) {
                return this.handleKeyCommand(ctrlCmdCommand);
            }
            return false;
        }

        switch (ev.keyCode) {
            case KeyCode.ENTER:
                return this.handleReturn(ev, change);
            case KeyCode.BACKSPACE:
                return this.onBackspace(ev, change);
            case KeyCode.UP:
                return this.onVerticalArrow(ev, true);
            case KeyCode.DOWN:
                return this.onVerticalArrow(ev, false);
            case KeyCode.TAB:
                return this.onTab(ev);
            case KeyCode.ESCAPE:
                return this.onEscape(ev);
            default:
                // don't intercept it
                return;
        }
    };

    onBackspace = (ev: Event, change: Change): Change => {
        if (this.state.isRichtextEnabled) {
            // let backspace exit lists
            const isList = this.hasBlock('list-item');
            const { editorState } = this.state;

            if (isList && editorState.anchorOffset == 0) {
                change
                    .setBlocks(DEFAULT_NODE)
                    .unwrapBlock('bulleted-list')
                    .unwrapBlock('numbered-list');
                return change;
            }
            else if (editorState.anchorOffset == 0 &&
                     (this.hasBlock('block-quote') ||
                      this.hasBlock('heading1') ||
                      this.hasBlock('heading2') ||
                      this.hasBlock('heading3') ||
                      this.hasBlock('heading4') ||
                      this.hasBlock('heading5') ||
                      this.hasBlock('heading6') ||
                      this.hasBlock('code-block')))
            {
                return change.setBlocks(DEFAULT_NODE);
            }
        }
        return;
    };

    handleKeyCommand = (command: string): boolean => {
        if (command === 'toggle-mode') {
            this.enableRichtext(!this.state.isRichtextEnabled);
            return true;
        }

        let newState: ?Value = null;

        // Draft handles rich text mode commands by default but we need to do it ourselves for Markdown.
        if (this.state.isRichtextEnabled) {
            const type = command;
            const { editorState } = this.state;
            const change = editorState.change();
            const { document } = editorState;
            switch (type) {
                // list-blocks:
                case 'bulleted-list':
                case 'numbered-list': {
                    // Handle the extra wrapping required for list buttons.
                    const isList = this.hasBlock('list-item');
                    const isType = editorState.blocks.some(block => {
                        return !!document.getClosest(block.key, parent => parent.type == type);
                    });

                    if (isList && isType) {
                        change
                            .setBlocks(DEFAULT_NODE)
                            .unwrapBlock('bulleted-list')
                            .unwrapBlock('numbered-list');
                    } else if (isList) {
                        change
                            .unwrapBlock(
                                type == 'bulleted-list' ? 'numbered-list' : 'bulleted-list'
                            )
                            .wrapBlock(type);
                    } else {
                        change.setBlocks('list-item').wrapBlock(type);
                    }
                }
                break;

                // simple blocks
                case 'paragraph':
                case 'block-quote':
                case 'heading1':
                case 'heading2':
                case 'heading3':
                case 'heading4':
                case 'heading5':
                case 'heading6':
                case 'list-item':
                case 'code-block': {
                    const isActive = this.hasBlock(type);
                    const isList = this.hasBlock('list-item');

                    if (isList) {
                        change
                            .setBlocks(isActive ? DEFAULT_NODE : type)
                            .unwrapBlock('bulleted-list')
                            .unwrapBlock('numbered-list');
                    } else {
                        change.setBlocks(isActive ? DEFAULT_NODE : type);
                    }
                }
                break;

                // marks:
                case 'bold':
                case 'italic':
                case 'code':
                case 'underlined':
                case 'deleted': {
                    change.toggleMark(type);
                }
                break;

                default:
                    console.warn(`ignoring unrecognised RTE command ${type}`);
                    return false;
            }

            this.onChange(change);

            return true;
        } else {
/*
            const contentState = this.state.editorState.getCurrentContent();
            const multipleLinesSelected = RichText.hasMultiLineSelection(this.state.editorState);

            const selectionState = this.state.editorState.getSelection();
            const start = selectionState.getStartOffset();
            const end = selectionState.getEndOffset();

            // If multiple lines are selected or nothing is selected, insert a code block
            // instead of applying inline code formatting. This is an attempt to mimic what
            // happens in non-MD mode.
            const treatInlineCodeAsBlock = multipleLinesSelected || start === end;
            const textMdCodeBlock = (text) => `\`\`\`\n${text}\n\`\`\`\n`;
            const modifyFn = {
                'bold': (text) => `**${text}**`,
                'italic': (text) => `*${text}*`,
                'underline': (text) => `<u>${text}</u>`,
                'strike': (text) => `<del>${text}</del>`,
                // ("code" is triggered by ctrl+j by draft-js by default)
                'code': (text) => treatInlineCodeAsBlock ? textMdCodeBlock(text) : `\`${text}\``,
                'code-block': textMdCodeBlock,
                'blockquote': (text) => text.split('\n').map((line) => `> ${line}\n`).join('') + '\n',
                'unordered-list-item': (text) => text.split('\n').map((line) => `\n- ${line}`).join(''),
                'ordered-list-item': (text) => text.split('\n').map((line, i) => `\n${i + 1}. ${line}`).join(''),
            }[command];

            const selectionAfterOffset = {
                'bold': -2,
                'italic': -1,
                'underline': -4,
                'strike': -6,
                'code': treatInlineCodeAsBlock ? -5 : -1,
                'code-block': -5,
                'blockquote': -2,
            }[command];

            // Returns a function that collapses a selection to its end and moves it by offset
            const collapseAndOffsetSelection = (selection, offset) => {
                const key = selection.endKey();
                return new Range({
                    anchorKey: key, anchorOffset: offset,
                    focusKey: key, focusOffset: offset,
                });
            };

            if (modifyFn) {

                const previousSelection = this.state.editorState.getSelection();
                const newContentState = RichText.modifyText(contentState, previousSelection, modifyFn);
                newState = EditorState.push(
                    this.state.editorState,
                    newContentState,
                    'insert-characters',
                );

                let newSelection = newContentState.getSelectionAfter();
                // If the selection range is 0, move the cursor inside the formatted body
                if (previousSelection.getStartOffset() === previousSelection.getEndOffset() &&
                    previousSelection.getStartKey() === previousSelection.getEndKey() &&
                    selectionAfterOffset !== undefined
                ) {
                    const selectedBlock = newContentState.getBlockForKey(previousSelection.getAnchorKey());
                    const blockLength = selectedBlock.getText().length;
                    const newOffset = blockLength + selectionAfterOffset;
                    newSelection = collapseAndOffsetSelection(newSelection, newOffset);
                }

                newState = EditorState.forceSelection(newState, newSelection);
            }
        }

        if (newState != null) {
            this.setState({editorState: newState});
            return true;
        }
*/
        }
        return false;
    };

    onPaste = (event: Event, change: Change, editor: Editor): Change => {
        const transfer = getEventTransfer(event);

        if (transfer.type === "files") {
            return this.props.onFilesPasted(transfer.files);
        }
        else if (transfer.type === "html") {
            const fragment = this.html.deserialize(transfer.html);
            if (this.state.isRichtextEnabled) {
                return change.insertFragment(fragment.document);
            }
            else {
                return change.insertText(this.md.serialize(fragment));
            }
        }
    };

    handleReturn = (ev, change) => {
        if (ev.shiftKey) {
            return change.insertText('\n');
        }

        if (this.state.editorState.blocks.some(
            block => ['code-block', 'block-quote', 'list-item'].includes(block.type)
        )) {
            // allow the user to terminate blocks by hitting return rather than sending a msg
            return;
        }

        const editorState = this.state.editorState;

        let contentText;
        let contentHTML;

        // only look for commands if the first block contains simple unformatted text
        // i.e. no pills or rich-text formatting.
        let cmd, commandText;
        const firstChild = editorState.document.nodes.get(0);
        const firstGrandChild = firstChild && firstChild.nodes.get(0);
        if (firstChild && firstGrandChild &&
            firstChild.object === 'block' && firstGrandChild.object === 'text' &&
            firstGrandChild.text[0] === '/')
        {
            commandText = this.plainWithIdPills.serialize(editorState);
            cmd = SlashCommands.processInput(this.props.room.roomId, commandText);
        }

        if (cmd) {
            if (!cmd.error) {
                this.historyManager.save(editorState, this.state.isRichtextEnabled ? 'rich' : 'markdown');
                this.setState({
                    editorState: this.createEditorState(),
                });
            }
            if (cmd.promise) {
                cmd.promise.then(()=>{
                    console.log("Command success.");
                    this.refs.editor.focus();
                }, (err)=>{
                    console.error("Command failure: %s", err);
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Server error', '', ErrorDialog, {
                        title: _t("Server error"),
                        description: ((err && err.message) ? err.message : _t("Server unavailable, overloaded, or something else went wrong.")),
                    });
                });
            } else if (cmd.error) {
                console.error(cmd.error);
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                // TODO possibly track which command they ran (not its Arguments) here
                Modal.createTrackedDialog('Command error', '', ErrorDialog, {
                    title: _t("Command error"),
                    description: cmd.error,
                });
            }
            return true;
        }

        const replyingToEv = RoomViewStore.getQuotingEvent();
        const mustSendHTML = Boolean(replyingToEv);

        if (this.state.isRichtextEnabled) {
            // We should only send HTML if any block is styled or contains inline style
            let shouldSendHTML = false;

            if (mustSendHTML) shouldSendHTML = true;

            if (!shouldSendHTML) {
                shouldSendHTML = !!editorState.document.findDescendant(node => {
                    // N.B. node.getMarks() might be private?
                    return ((node.object === 'block' && node.type !== 'line') ||
                            (node.object === 'inline') ||
                            (node.object === 'text' && node.getMarks().size > 0));
                });
            }

            contentText = this.plainWithPlainPills.serialize(editorState);
            if (contentText === '') return true;

            if (shouldSendHTML) {
                contentHTML = this.html.serialize(editorState); // HtmlUtils.processHtmlForSending();
            }
        } else {
            const sourceWithPills = this.plainWithMdPills.serialize(editorState);
            if (sourceWithPills === '') return true;

            const mdWithPills = new Markdown(sourceWithPills);

            // if contains no HTML and we're not quoting (needing HTML)
            if (mdWithPills.isPlainText() && !mustSendHTML) {
                // N.B. toPlainText is only usable here because we know that the MD
                // didn't contain any formatting in the first place...
                contentText = mdWithPills.toPlaintext();
            } else {
                // to avoid ugliness clients which can't parse HTML we don't send pills
                // in the plaintext body.
                contentText = this.plainWithPlainPills.serialize(editorState);
                contentHTML = mdWithPills.toHTML();
            }
        }

        let sendHtmlFn = ContentHelpers.makeHtmlMessage;
        let sendTextFn = ContentHelpers.makeTextMessage;

        this.historyManager.save(
            editorState,
            this.state.isRichtextEnabled ? 'rich' : 'markdown',
        );

        if (commandText && commandText.startsWith('/me')) {
            if (replyingToEv) {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Emote Reply Fail', '', ErrorDialog, {
                    title: _t("Unable to reply"),
                    description: _t("At this time it is not possible to reply with an emote."),
                });
                return false;
            }

            contentText = contentText.substring(4);
            // bit of a hack, but the alternative would be quite complicated
            if (contentHTML) contentHTML = contentHTML.replace(/\/me ?/, '');
            sendHtmlFn = ContentHelpers.makeHtmlEmote;
            sendTextFn = ContentHelpers.makeEmoteMessage;
        }

        let content = contentHTML ?
                      sendHtmlFn(contentText, contentHTML) :
                      sendTextFn(contentText);

        if (replyingToEv) {
            const replyContent = ReplyThread.makeReplyMixIn(replyingToEv);
            content = Object.assign(replyContent, content);

            // Part of Replies fallback support - prepend the text we're sending
            // with the text we're replying to
            const nestedReply = ReplyThread.getNestedReplyText(replyingToEv);
            if (nestedReply) {
                if (content.formatted_body) {
                    content.formatted_body = nestedReply.html + content.formatted_body;
                }
                content.body = nestedReply.body + content.body;
            }

            // Clear reply_to_event as we put the message into the queue
            // if the send fails, retry will handle resending.
            dis.dispatch({
                action: 'reply_to_event',
                event: null,
            });
        }

        this.client.sendMessage(this.props.room.roomId, content).then((res) => {
            dis.dispatch({
                action: 'message_sent',
            });
        }).catch((e) => {
            onSendMessageFailed(e, this.props.room);
        });

        this.setState({
            editorState: this.createEditorState(),
        }, ()=>{ this.refs.editor.focus() });

        return true;
    };

    onVerticalArrow = (e, up) => {
        if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
            return;
        }

        // Select history only if we are not currently auto-completing
        if (this.autocomplete.state.completionList.length === 0) {

            // determine whether our cursor is at the top or bottom of the multiline
            // input box by just looking at the position of the plain old DOM selection.
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const cursorRect = range.getBoundingClientRect();

            const editorNode = ReactDOM.findDOMNode(this.refs.editor);
            const editorRect = editorNode.getBoundingClientRect();

            // heuristic to handle tall emoji, pills, etc pushing the cursor away from the top
            // or bottom of the page.
            // XXX: is this going to break on large inline images or top-to-bottom scripts?
            const EDGE_THRESHOLD = 8;

            let navigateHistory = false;
            if (up) {
                const scrollCorrection = editorNode.scrollTop;
                const distanceFromTop = cursorRect.top - editorRect.top + scrollCorrection;
                console.log(`Cursor distance from editor top is ${distanceFromTop}`);
                if (distanceFromTop < EDGE_THRESHOLD) {
                    navigateHistory = true;
                }
            }
            else {
                const scrollCorrection =
                    editorNode.scrollHeight - editorNode.clientHeight - editorNode.scrollTop;
                const distanceFromBottom = editorRect.bottom - cursorRect.bottom + scrollCorrection;
                console.log(`Cursor distance from editor bottom is ${distanceFromBottom}`);
                if (distanceFromBottom < EDGE_THRESHOLD) {
                    navigateHistory = true;
                }
            }

            if (!navigateHistory) return;

            const selected = this.selectHistory(up);
            if (selected) {
                // We're selecting history, so prevent the key event from doing anything else
                e.preventDefault();
            }
        } else {
            this.moveAutocompleteSelection(up);
            e.preventDefault();
        }
    };

    selectHistory = async (up) => {
        const delta = up ? -1 : 1;

        // True if we are not currently selecting history, but composing a message
        if (this.historyManager.currentIndex === this.historyManager.history.length) {
            // We can't go any further - there isn't any more history, so nop.
            if (!up) {
                return;
            }
            this.setState({
                currentlyComposedEditorState: this.state.editorState,
            });
        } else if (this.historyManager.currentIndex + delta === this.historyManager.history.length) {
            // True when we return to the message being composed currently
            this.setState({
                editorState: this.state.currentlyComposedEditorState,
            });
            this.historyManager.currentIndex = this.historyManager.history.length;
            return;
        }

        let editorState = this.historyManager.getItem(delta, this.state.isRichtextEnabled ? 'rich' : 'markdown');

        // Move selection to the end of the selected history
        const change = editorState.change().collapseToEndOf(editorState.document);

        // XXX: should we be calling this.onChange(change) now?
        // Answer: yes, if we want it to do any of the fixups on stuff like emoji.
        // however, this should already have been done and persisted in the history,
        // so shouldn't be necessary.

        editorState = change.value;

        this.suppressAutoComplete = true;

        this.setState({ editorState }, ()=>{
            this.refs.editor.focus();
        });
        return true;
    };

    onTab = async (e) => {
        this.setState({
            someCompletions: null,
        });
        e.preventDefault();
        if (this.autocomplete.state.completionList.length === 0) {
            // Force completions to show for the text currently entered
            const completionCount = await this.autocomplete.forceComplete();
            this.setState({
                someCompletions: completionCount > 0,
            });
            // Select the first item by moving "down"
            await this.moveAutocompleteSelection(false);
        } else {
            await this.moveAutocompleteSelection(e.shiftKey);
        }
    };

    moveAutocompleteSelection = (up) => {
        up ? this.autocomplete.onUpArrow() : this.autocomplete.onDownArrow();
    };

    onEscape = async (e) => {
        e.preventDefault();
        if (this.autocomplete) {
            this.autocomplete.onEscape(e);
        }
        await this.setDisplayedCompletion(null); // restore originalEditorState
    };

    /* returns inline style and block type of current SelectionState so MessageComposer can render formatting
     buttons. */
    getSelectionInfo(editorState: Value) {
        return {
            marks: editorState.activeMarks,
            // XXX: shouldn't we return all the types of blocks in the current selection,
            // not just the anchor?
            blockType: editorState.anchorBlock ? editorState.anchorBlock.type : null,
        };
    }

    /* If passed null, restores the original editor content from state.originalEditorState.
     * If passed a non-null displayedCompletion, modifies state.originalEditorState to compute new state.editorState.
     */
    setDisplayedCompletion = async (displayedCompletion: ?Completion): boolean => {
        const activeEditorState = this.state.originalEditorState || this.state.editorState;

        if (displayedCompletion == null) {
            if (this.state.originalEditorState) {
                let editorState = this.state.originalEditorState;
                this.setState({editorState});
            }
            return false;
        }

        const {
            range = null,
            completion = '',
            completionId = '',
            href = null,
            suffix = ''
        } = displayedCompletion;

        let inline;
        if (href) {
            inline = Inline.create({
                type: 'pill',
                data: { completion, completionId, href },
                // we can't put text in here otherwise the editor tries to select it
                isVoid: true,
            });
        } else if (completion === '@room') {
            inline = Inline.create({
                type: 'pill',
                data: { completion, completionId },
                // we can't put text in here otherwise the editor tries to select it
                isVoid: true,
            });
        }

        let editorState = activeEditorState;

        if (range) {
            const change = editorState.change()
                                      .collapseToAnchor()
                                      .moveOffsetsTo(range.start, range.end);
            editorState = change.value;
        }

        let change;
        if (inline) {
            change = editorState.change()
                                .insertInlineAtRange(editorState.selection, inline)
                                .insertText(suffix);
        }
        else {
            change = editorState.change()
                                .insertTextAtRange(editorState.selection, completion)
                                .insertText(suffix);
        }
        editorState = change.value;

        this.onChange(change, activeEditorState);

        return true;
    };

    renderNode = props => {
        const { attributes, children, node, isSelected } = props;

        switch (node.type) {
            case 'line':
                // ideally we'd return { children }<br/>, but as this isn't
                // a valid react component, we don't have much choice.
                return <div {...attributes}>{children}</div>;
            case 'paragraph':
                return <p {...attributes}>{children}</p>;
            case 'block-quote':
                return <blockquote {...attributes}>{children}</blockquote>;
            case 'bulleted-list':
                return <ul {...attributes}>{children}</ul>;
            case 'heading1':
                return <h1 {...attributes}>{children}</h1>;
            case 'heading2':
                return <h2 {...attributes}>{children}</h2>;
            case 'heading3':
                return <h3 {...attributes}>{children}</h3>;
            case 'heading4':
                return <h4 {...attributes}>{children}</h4>;
            case 'heading5':
                return <h5 {...attributes}>{children}</h5>;
            case 'heading6':
                return <h6 {...attributes}>{children}</h6>;
            case 'list-item':
                return <li {...attributes}>{children}</li>;
            case 'numbered-list':
                return <ol {...attributes}>{children}</ol>;
            case 'code-block':
                return <pre {...attributes}><code {...attributes}>{children}</code></pre>;
            case 'link': 
                return <a {...attributes} href={ node.data.get('href') }>{children}</a>;
            case 'pill': {
                const { data } = node;
                const url = data.get('href');
                const completion = data.get('completion');

                const shouldShowPillAvatar = !SettingsStore.getValue("Pill.shouldHidePillAvatar");
                const Pill = sdk.getComponent('elements.Pill');

                if (completion === '@room') {
                    return <Pill
                            type={Pill.TYPE_AT_ROOM_MENTION}
                            room={this.props.room}
                            shouldShowPillAvatar={shouldShowPillAvatar}
                            isSelected={isSelected}
                            />;
                }
                else if (Pill.isPillUrl(url)) {
                    return <Pill
                            url={url}
                            room={this.props.room}
                            shouldShowPillAvatar={shouldShowPillAvatar}
                            isSelected={isSelected}
                            />;
                }
                else {
                    const { text } = node;
                    return <a href={url} {...props.attributes}>
                                { text }
                           </a>;
                }
            }
            case 'emoji': {
                const { data } = node;
                const emojiUnicode = data.get('emojiUnicode');
                const uri = RichText.unicodeToEmojiUri(emojiUnicode);
                const shortname = toShort(emojiUnicode);
                const className = classNames('mx_emojione', {
                    mx_emojione_selected: isSelected
                });
                return <img className={ className } src={ uri } title={ shortname } alt={ emojiUnicode }/>;
            }
        }
    };

    renderMark = props => {
        const { children, mark, attributes } = props;
        switch (mark.type) {
            case 'bold':
                return <strong {...attributes}>{children}</strong>;
            case 'italic':
                return <em {...attributes}>{children}</em>;
            case 'code':
                return <code {...attributes}>{children}</code>;
            case 'underlined':
                return <u {...attributes}>{children}</u>;
            case 'deleted':
                return <del {...attributes}>{children}</del>;
        }
    };

    onFormatButtonClicked = (name: "bold" | "italic" | "strike" | "code" | "underline" | "quote" | "bullet" | "numbullet", e) => {
        e.preventDefault(); // don't steal focus from the editor!

        const command = {
                // code: 'code-block', // let's have the button do inline code for now
                quote: 'block-quote',
                bullet: 'bulleted-list',
                numbullet: 'numbered-list',
                underline: 'underlined',
                strike: 'deleted',
            }[name] || name;
        this.handleKeyCommand(command);
    };

    getAutocompleteQuery(editorState: Value) {
        // We can just return the current block where the selection begins, which
        // should be enough to capture any autocompletion input, given autocompletion
        // providers only search for the first match which intersects with the current selection.
        // This avoids us having to serialize the whole thing to plaintext and convert
        // selection offsets in & out of the plaintext domain.

        if (editorState.selection.anchorKey) {
            return editorState.document.getDescendant(editorState.selection.anchorKey).text;
        }
        else {
            return '';
        }
    }

    getSelectionRange(editorState: Value) {
        let beginning = false;
        const query = this.getAutocompleteQuery(editorState);
        const firstChild = editorState.document.nodes.get(0);
        const firstGrandChild = firstChild && firstChild.nodes.get(0);
        beginning = (firstChild && firstGrandChild &&
                     firstChild.object === 'block' && firstGrandChild.object === 'text' &&
                     editorState.selection.anchorKey === firstGrandChild.key);

        // return a character range suitable for handing to an autocomplete provider.
        // the range is relative to the anchor of the current editor selection.
        // if the selection spans multiple blocks, then we collapse it for the calculation.
        const range = {
            beginning, // whether the selection is in the first block of the editor or not
            start: editorState.selection.anchorOffset,
            end: (editorState.selection.anchorKey == editorState.selection.focusKey) ?
                 editorState.selection.focusOffset : editorState.selection.anchorOffset,
        }
        if (range.start > range.end) {
            const tmp = range.start;
            range.start = range.end;
            range.end = tmp;
        }
        return range;
    }

    onMarkdownToggleClicked = (e) => {
        e.preventDefault(); // don't steal focus from the editor!
        this.handleKeyCommand('toggle-mode');
    };

    render() {
        const activeEditorState = this.state.originalEditorState || this.state.editorState;

        const className = classNames('mx_MessageComposer_input', {
            mx_MessageComposer_input_error: this.state.someCompletions === false,
        });

        return (
            <div className="mx_MessageComposer_input_wrapper">
                <div className="mx_MessageComposer_autocomplete_wrapper">
                    { SettingsStore.isFeatureEnabled("feature_rich_quoting") && <ReplyPreview /> }
                    <Autocomplete
                        ref={(e) => this.autocomplete = e}
                        room={this.props.room}
                        onConfirm={this.setDisplayedCompletion}
                        onSelectionChange={this.setDisplayedCompletion}
                        query={ this.suppressAutoComplete ? '' : this.getAutocompleteQuery(activeEditorState) }
                        selection={this.getSelectionRange(activeEditorState)}
                    />
                </div>
                <div className={className}>
                    <img className="mx_MessageComposer_input_markdownIndicator mx_filterFlipColor"
                         onMouseDown={this.onMarkdownToggleClicked}
                         title={this.state.isRichtextEnabled ? _t("Markdown is disabled") : _t("Markdown is enabled")}
                         src={`img/button-md-${!this.state.isRichtextEnabled}.png`} />
                    <Editor ref="editor"
                            dir="auto"
                            className="mx_MessageComposer_editor"
                            placeholder={this.props.placeholder}
                            value={this.state.editorState}
                            onChange={this.onChange}
                            onKeyDown={this.onKeyDown}
                            onPaste={this.onPaste}
                            renderNode={this.renderNode}
                            renderMark={this.renderMark}
                            spellCheck={true}
                            />
                </div>
            </div>
        );
    }
}
