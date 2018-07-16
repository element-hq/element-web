/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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
import { Value, Document, Block, Inline, Text, Range, Node } from 'slate';
import type { Change } from 'slate';

import Html from 'slate-html-serializer';
import Md from 'slate-md-serializer';
import Plain from 'slate-plain-serializer';
import PlainWithPillsSerializer from "../../../autocomplete/PlainWithPillsSerializer";

import classNames from 'classnames';
import Promise from 'bluebird';

import MatrixClientPeg from '../../../MatrixClientPeg';
import type {MatrixClient} from 'matrix-js-sdk/lib/matrix';
import {processCommandInput} from '../../../SlashCommands';
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

import {MATRIXTO_MD_LINK_PATTERN, MATRIXTO_URL_PATTERN} from '../../../linkify-matrix';
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

// the Slate node type to default to for unstyled text
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
    pre: 'code',
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

function rangeEquals(a: Range, b: Range): boolean {
    return (a.anchorKey === b.anchorKey
        && a.anchorOffset === b.anchorOffset
        && a.focusKey === b.focusKey
        && a.focusOffset === b.focusOffset
        && a.isFocused === b.isFocused
        && a.isBackward === b.isBackward);
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

        onFilesPasted: PropTypes.func,

        onInputStateChanged: PropTypes.func,
    };

    client: MatrixClient;
    autocomplete: Autocomplete;
    historyManager: ComposerHistoryManager;

    constructor(props, context) {
        super(props, context);

        const isRichTextEnabled = SettingsStore.getValue('MessageComposerInput.isRichTextEnabled');

        Analytics.setRichtextMode(isRichTextEnabled);

        this.client = MatrixClientPeg.get();

        // track whether we should be trying to show autocomplete suggestions on the current editor
        // contents. currently it's only suppressed when navigating history to avoid ugly flashes
        // of unexpected corrections as you navigate.
        // XXX: should this be in state?
        this.suppressAutoComplete = false;

        // track whether we've just pressed an arrowkey left or right in order to skip void nodes.
        // see https://github.com/ianstormtaylor/slate/issues/762#issuecomment-304855095
        this.direction = '';

        this.plainWithMdPills    = new PlainWithPillsSerializer({ pillFormat: 'md' });
        this.plainWithIdPills    = new PlainWithPillsSerializer({ pillFormat: 'id' });
        this.plainWithPlainPills = new PlainWithPillsSerializer({ pillFormat: 'plain' });

        this.md = new Md({
            rules: [
                {
                    // if serialize returns undefined it falls through to the default hardcoded
                    // serialization rules
                    serialize: (obj, children) => {
                        if (obj.object !== 'inline') return;
                        switch (obj.type) {
                            case 'pill':
                                return `[${ obj.data.get('completion') }](${ obj.data.get('href') })`;
                            case 'emoji':
                                return obj.data.get('emojiUnicode');
                        }
                    },
                }, {
                    serialize: (obj, children) => {
                        if (obj.object !== 'mark') return;
                        // XXX: slate-md-serializer consumes marks other than bold, italic, code, inserted, deleted
                        switch (obj.type) {
                            case 'underlined':
                                return `<u>${ children }</u>`;
                            case 'deleted':
                                return `<del>${ children }</del>`;
                            case 'code':
                                // XXX: we only ever get given `code` regardless of whether it was inline or block
                                // XXX: workaround for https://github.com/tommoor/slate-md-serializer/issues/14
                                // strip single backslashes from children, as they would have been escaped here
                                return `\`${ children.split('\\').map((v) => v ? v : '\\').join('') }\``;
                        }
                    },
                },
            ],
        });

        this.html = new Html({
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
                            let m;
                            if (href) {
                                m = href.match(MATRIXTO_URL_PATTERN);
                            }
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
                        if (obj.object === 'block') {
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
                        else if (obj.object === 'inline') {
                            // special case links, pills and emoji otherwise we
                            // end up with React components getting rendered out(!)
                            switch (obj.type) {
                                case 'pill':
                                    return <a href={ obj.data.get('href') }>{ obj.data.get('completion') }</a>;
                                case 'link':
                                    return <a href={ obj.data.get('href') }>{ children }</a>;
                                case 'emoji':
                                    // XXX: apparently you can't return plain strings from serializer rules
                                    // until https://github.com/ianstormtaylor/slate/pull/1854 is merged.
                                    // So instead we temporarily wrap emoji from RTE in an arbitrary tag
                                    // (<b/>).  <span/> would be nicer, but in practice it causes CSS issues.
                                    return <b>{ obj.data.get('emojiUnicode') }</b>;
                            }
                            return this.renderNode({
                                node: obj,
                                children: children,
                            });
                        }
                    }
                }
            ]
        });

        const savedState = MessageComposerStore.getEditorState(this.props.room.roomId);
        this.state = {
            // whether we're in rich text or markdown mode
            isRichTextEnabled,

            // the currently displayed editor state (note: this is always what is modified on input)
            editorState: this.createEditorState(
                isRichTextEnabled,
                savedState ? savedState.editor_state : undefined,
                savedState ? savedState.rich_text : undefined,
            ),

            // the original editor state, before we started tabbing through completions
            originalEditorState: null,

            // the virtual state "above" the history stack, the message currently being composed that
            // we want to persist whilst browsing history
            currentlyComposedEditorState: null,

            // whether there were any completions
            someCompletions: null,
        };
    }

    /*
     * "Does the right thing" to create an Editor value, based on:
     * - whether we've got rich text mode enabled
     * - contentState was passed in
     * - whether the contentState that was passed in was rich text
     */
    createEditorState(wantRichText: boolean, editorState: ?Value, wasRichText: ?boolean): Value {
        if (editorState instanceof Value) {
            if (wantRichText && !wasRichText) {
                return this.mdToRichEditorState(editorState);
            }
            if (wasRichText && !wantRichText) {
                return this.richToMdEditorState(editorState);
            }
            return editorState;
        } else {
            // ...or create a new one.
            return Plain.deserialize('', { defaultBlock: DEFAULT_NODE });
        }
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.historyManager = new ComposerHistoryManager(this.props.room.roomId, 'mx_slate_composer_history_');
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    onAction = (payload) => {
        const editor = this.refs.editor;
        let editorState = this.state.editorState;

        switch (payload.action) {
            case 'reply_to_event':
            case 'focus_composer':
                this.focusComposer();
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
            case 'quote': {
                const html = HtmlUtils.bodyToHtml(payload.event.getContent(), null, {
                    returnString: true,
                    emojiOne: false,
                });
                const fragment = this.html.deserialize(html);
                // FIXME: do we want to put in a permalink to the original quote here?
                // If so, what should be the format, and how do we differentiate it from replies?

                const quote = Block.create('block-quote');
                if (this.state.isRichTextEnabled) {
                    let change = editorState.change();
                    if (editorState.anchorText.text === '' && editorState.anchorBlock.nodes.size === 1) {
                        // replace the current block rather than split the block
                        change = change.replaceNodeByKey(editorState.anchorBlock.key, quote);
                    }
                    else {
                        // insert it into the middle of the block (splitting it)
                        change = change.insertBlock(quote);
                    }
                    change = change.insertFragmentByKey(quote.key, 0, fragment.document)
                                   .focus();
                    this.onChange(change);
                }
                else {
                    let fragmentChange = fragment.change();
                    fragmentChange.moveToRangeOf(fragment.document)
                                  .wrapBlock(quote);

                    // FIXME: handle pills and use commonmark rather than md-serialize
                    const md = this.md.serialize(fragmentChange.value);
                    let change = editorState.change()
                                            .insertText(md + '\n\n')
                                            .focus();
                    this.onChange(change);
                }
            }
                break;
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

    onChange = (change: Change, originalEditorState?: Value) => {
        let editorState = change.value;

        if (this.direction !== '') {
            const focusedNode = editorState.focusInline || editorState.focusText;
            if (focusedNode.isVoid) {
                // XXX: does this work in RTL?
                const edge = this.direction === 'Previous' ? 'End' : 'Start';
                if (editorState.isCollapsed) {
                    change = change[`collapseTo${ edge }Of${ this.direction }Text`]();
                } else {
                    const block = this.direction === 'Previous' ? editorState.previousText : editorState.nextText;
                    if (block) {
                        change = change[`moveFocusTo${ edge }Of`](block);
                    }
                }
                editorState = change.value;
            }
        }

        // when selection changes hide the autocomplete.
        // Selection changes when we enter text so use a heuristic to compare documents without doing it recursively
        const documentChanged = this.state.editorState.document.text !== editorState.document.text;
        if (!documentChanged && !rangeEquals(this.state.editorState.selection, editorState.selection)) {
            this.autocomplete.hide();
        }

        if (!editorState.document.isEmpty) {
            this.onTypingActivity();
        } else {
            this.onFinishedTyping();
        }

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
                        focusOffset: currentStartOffset - 1,
                    });
                    change = change.insertTextAtRange(range, unicodeEmoji);
                    editorState = change.value;
                }
            }
        }

        // emojioneify any emoji
        editorState.document.getTexts().forEach(node => {
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

        // work around weird bug where inserting emoji via the macOS
        // emoji picker can leave the selection stuck in the emoji's
        // child text.  This seems to happen due to selection getting
        // moved in the normalisation phase after calculating these changes
        if (editorState.anchorKey &&
            editorState.document.getParent(editorState.anchorKey).type === 'emoji')
        {
            change = change.collapseToStartOfNextText();
            editorState = change.value;
        }

        if (this.props.onInputStateChanged && editorState.blocks.size > 0) {
            let blockType = editorState.blocks.first().type;
            // console.log("onInputStateChanged; current block type is " + blockType + " and marks are " + editorState.activeMarks);

            if (blockType === 'list-item') {
                const parent = editorState.document.getParent(editorState.blocks.first().key);
                if (parent.type === 'numbered-list') {
                    blockType = 'numbered-list';
                }
                else if (parent.type === 'bulleted-list') {
                    blockType = 'bulleted-list';
                }
            }
            const inputState = {
                marks: editorState.activeMarks,
                isRichTextEnabled: this.state.isRichTextEnabled,
                blockType
            };
            this.props.onInputStateChanged(inputState);
        }

        // Record the editor state for this room so that it can be retrieved after switching to another room and back
        MessageComposerStore.setEditorState(this.props.room.roomId, editorState, this.state.isRichTextEnabled);

        this.setState({
            editorState,
            originalEditorState: originalEditorState || null
        });
    };

    mdToRichEditorState(editorState: Value): Value {
        // for consistency when roundtripping, we could use slate-md-serializer rather than
        // commonmark, but then we would lose pills as the MD deserialiser doesn't know about
        // them and doesn't have any extensibility hooks.
        //
        // The code looks like this:
        //
        // const markdown = this.plainWithMdPills.serialize(editorState);
        //
        // // weirdly, the Md serializer can't deserialize '' to a valid Value...
        // if (markdown !== '') {
        //     editorState = this.md.deserialize(markdown);
        // }
        // else {
        //     editorState = Plain.deserialize('', { defaultBlock: DEFAULT_NODE });
        // }

        // so, instead, we use commonmark proper (which is arguably more logical to the user
        // anyway, as they'll expect the RTE view to match what they'll see in the timeline,
        // but the HTML->MD conversion is anyone's guess).

        const textWithMdPills = this.plainWithMdPills.serialize(editorState);
        const markdown = new Markdown(textWithMdPills);
        // HTML deserialize has custom rules to turn matrix.to links into pill objects.
        return this.html.deserialize(markdown.toHTML());
    }

    richToMdEditorState(editorState: Value): Value {
        // FIXME: this conversion loses pills (turning them into pure MD links).
        // We need to add a pill-aware deserialize method
        // to PlainWithPillsSerializer which recognises pills in raw MD and turns them into pills.
        return Plain.deserialize(
            // FIXME: we compile the MD out of the RTE state using slate-md-serializer
            // which doesn't roundtrip symmetrically with commonmark, which we use for
            // compiling MD out of the MD editor state above.
            this.md.serialize(editorState),
            { defaultBlock: DEFAULT_NODE }
        );
    }

    enableRichtext(enabled: boolean) {
        if (enabled === this.state.isRichTextEnabled) return;

        let editorState = null;
        if (enabled) {
            editorState = this.mdToRichEditorState(this.state.editorState);
        } else {
            editorState = this.richToMdEditorState(this.state.editorState);
        }

        Analytics.setRichtextMode(enabled);

        this.setState({
            editorState: this.createEditorState(enabled, editorState),
            isRichTextEnabled: enabled,
        }, ()=>{
            this.refs.editor.focus();
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
        return editorState.activeMarks.some(mark => mark.type === type)
    };

    /**
    * Check if the any of the currently selected blocks are of `type`.
    *
    * @param {String} type
    * @return {Boolean}
    */

    hasBlock = type => {
        const { editorState } = this.state
        return editorState.blocks.some(node => node.type === type)
    };

    onKeyDown = (ev: KeyboardEvent, change: Change, editor: Editor) => {

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
            case KeyCode.SPACE:
                return this.onSpace(ev, change);
        }

        if (isOnlyCtrlOrCmdKeyEvent(ev)) {
            const ctrlCmdCommand = {
                // C-m => Toggles between rich text and markdown modes
                [KeyCode.KEY_M]: 'toggle-mode',
                [KeyCode.KEY_B]: 'bold',
                [KeyCode.KEY_I]: 'italic',
                [KeyCode.KEY_U]: 'underlined',
                [KeyCode.KEY_J]: 'inline-code',
            }[ev.keyCode];

            if (ctrlCmdCommand) {
                return this.handleKeyCommand(ctrlCmdCommand);
            }
        }
    };

    onSpace = (ev: KeyboardEvent, change: Change): Change => {
        if (ev.metaKey || ev.altKey || ev.shiftKey || ev.ctrlKey) {
            return;
        }

        // drop a point in history so the user can undo a word
        // XXX: this seems nasty but adding to history manually seems a no-go
        ev.preventDefault();
        return change.setOperationFlag("skip", false).setOperationFlag("merge", false).insertText(ev.key);
    };

    onBackspace = (ev: KeyboardEvent, change: Change): Change => {
        if (ev.metaKey || ev.altKey || ev.shiftKey) {
            return;
        }

        const { editorState } = this.state;

        // Allow Ctrl/Cmd-Backspace when focus starts at the start of the composer (e.g select-all)
        // for some reason if slate sees you Ctrl-backspace and your anchorOffset=0 it just resets your focus
        if (!editorState.isCollapsed && editorState.anchorOffset === 0) {
            return change.delete();
        }

        if (this.state.isRichTextEnabled) {
            // let backspace exit lists
            const isList = this.hasBlock('list-item');

            if (isList && editorState.anchorOffset == 0) {
                change
                    .setBlocks(DEFAULT_NODE)
                    .unwrapBlock('bulleted-list')
                    .unwrapBlock('numbered-list');
                return change;
            }
            else if (editorState.anchorOffset == 0 && editorState.isCollapsed) {
                // turn blocks back into paragraphs
                if ((this.hasBlock('block-quote') ||
                     this.hasBlock('heading1') ||
                     this.hasBlock('heading2') ||
                     this.hasBlock('heading3') ||
                     this.hasBlock('heading4') ||
                     this.hasBlock('heading5') ||
                     this.hasBlock('heading6') ||
                     this.hasBlock('code')))
                {
                    return change.setBlocks(DEFAULT_NODE);
                }

                // remove paragraphs entirely if they're nested
                const parent = editorState.document.getParent(editorState.anchorBlock.key);
                if (editorState.anchorOffset == 0 &&
                    this.hasBlock('paragraph') &&
                    parent.nodes.size == 1 &&
                    parent.object !== 'document')
                {
                    return change.replaceNodeByKey(editorState.anchorBlock.key, editorState.anchorText)
                                 .collapseToEndOf(parent)
                                 .focus();
                }
            }
        }
        return;
    };

    handleKeyCommand = (command: string): boolean => {
        if (command === 'toggle-mode') {
            this.enableRichtext(!this.state.isRichTextEnabled);
            return true;
        }

        let newState: ?Value = null;

        // Draft handles rich text mode commands by default but we need to do it ourselves for Markdown.
        if (this.state.isRichTextEnabled) {
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
                        return !!document.getClosest(block.key, parent => parent.type === type);
                    });

                    if (isList && isType) {
                        change
                            .setBlocks(DEFAULT_NODE)
                            .unwrapBlock('bulleted-list')
                            .unwrapBlock('numbered-list');
                    } else if (isList) {
                        change
                            .unwrapBlock(
                                type === 'bulleted-list' ? 'numbered-list' : 'bulleted-list'
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
                case 'code': {
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
                case 'inline-code':
                case 'underlined':
                case 'deleted': {
                    change.toggleMark(type === 'inline-code' ? 'code' : type);
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
                'code': textMdCodeBlock,
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
                'code': -5,
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
            // FIXME: https://github.com/ianstormtaylor/slate/issues/1497 means
            // that we will silently discard nested blocks (e.g. nested lists) :(
            const fragment = this.html.deserialize(transfer.html);
            if (this.state.isRichTextEnabled) {
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
            block => ['code', 'block-quote', 'list-item'].includes(block.type)
        )) {
            // allow the user to terminate blocks by hitting return rather than sending a msg
            return;
        }

        const editorState = this.state.editorState;

        let contentText;
        let contentHTML;

        // only look for commands if the first block contains simple unformatted text
        // i.e. no pills or rich-text formatting and begins with a /.
        let cmd, commandText;
        const firstChild = editorState.document.nodes.get(0);
        const firstGrandChild = firstChild && firstChild.nodes.get(0);
        if (firstChild && firstGrandChild &&
            firstChild.object === 'block' && firstGrandChild.object === 'text' &&
            firstGrandChild.text[0] === '/')
        {
            commandText = this.plainWithIdPills.serialize(editorState);
            cmd = processCommandInput(this.props.room.roomId, commandText);
        }

        if (cmd) {
            if (!cmd.error) {
                this.historyManager.save(editorState, this.state.isRichTextEnabled ? 'rich' : 'markdown');
                this.setState({
                    editorState: this.createEditorState(),
                }, ()=>{
                    this.refs.editor.focus();
                });
            }
            if (cmd.promise) {
                cmd.promise.then(()=>{
                    console.log("Command success.");
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

        if (this.state.isRichTextEnabled) {
            // We should only send HTML if any block is styled or contains inline style
            let shouldSendHTML = false;

            if (mustSendHTML) shouldSendHTML = true;

            if (!shouldSendHTML) {
                shouldSendHTML = !!editorState.document.findDescendant(node => {
                    // N.B. node.getMarks() might be private?
                    return ((node.object === 'block' && node.type !== 'paragraph') ||
                            (node.object === 'inline') ||
                            (node.object === 'text' && node.getMarks().size > 0));
                });
            }

            contentText = this.plainWithPlainPills.serialize(editorState);
            if (contentText === '') return true;

            if (shouldSendHTML) {
                // FIXME: should we strip out the surrounding <p></p>?
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
                // to avoid ugliness on clients which ignore the HTML body we don't
                // send pills in the plaintext body.
                contentText = this.plainWithPlainPills.serialize(editorState);
                contentHTML = mdWithPills.toHTML();
            }
        }

        let sendHtmlFn = ContentHelpers.makeHtmlMessage;
        let sendTextFn = ContentHelpers.makeTextMessage;

        this.historyManager.save(
            editorState,
            this.state.isRichTextEnabled ? 'rich' : 'markdown',
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
            const selection = this.state.editorState.selection;

            // selection must be collapsed
            if (!selection.isCollapsed) return;
            const document = this.state.editorState.document;

            // and we must be at the edge of the document (up=start, down=end)
            if (up) {
                if (!selection.isAtStartOf(document)) return;
            } else {
                if (!selection.isAtEndOf(document)) return;
            }

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

        let editorState;
        const historyItem = this.historyManager.getItem(delta);
        if (historyItem) {
            if (historyItem.format === 'rich' && !this.state.isRichTextEnabled) {
                editorState = this.richToMdEditorState(historyItem.value);
            }
            else if (historyItem.format === 'markdown' && this.state.isRichTextEnabled) {
                editorState = this.mdToRichEditorState(historyItem.value);
            }
            else {
                editorState = historyItem.value;
            }
        }

        // Move selection to the end of the selected history
        const change = editorState.change().collapseToEndOf(editorState.document);

        // We don't call this.onChange(change) now, as fixups on stuff like emoji
        // should already have been done and persisted in the history.
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
                                      .moveOffsetsTo(range.start, range.end)
                                      .focus();
            editorState = change.value;
        }

        let change;
        if (inline) {
            change = editorState.change()
                                .insertInlineAtRange(editorState.selection, inline)
                                .insertText(suffix)
                                .focus();
        }
        else {
            change = editorState.change()
                                .insertTextAtRange(editorState.selection, completion)
                                .insertText(suffix)
                                .focus();
        }
        // for good hygiene, keep editorState updated to track the result of the change
        // even though we don't do anything subsequently with it
        editorState = change.value;

        this.onChange(change, activeEditorState);

        return true;
    };

    renderNode = props => {
        const { attributes, children, node, isSelected } = props;

        switch (node.type) {
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
            case 'code':
                return <pre {...attributes}>{children}</pre>;
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

    onFormatButtonClicked = (name, e) => {
        e.preventDefault();

        // XXX: horrible evil hack to ensure the editor is focused so the act
        // of focusing it doesn't then cancel the format button being pressed
        // FIXME: can we just tell handleKeyCommand's change to invoke .focus()?
        if (document.activeElement && document.activeElement.className !== 'mx_MessageComposer_editor') {
            this.refs.editor.focus();
            setTimeout(()=>{
                this.handleKeyCommand(name);
            }, 500); // can't find any callback to hook this to. onFocus and onChange and willComponentUpdate fire too early.
            return;
        }

        this.handleKeyCommand(name);
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

    onBlur = (e) => {
        this.selection = this.state.editorState.selection;
    };

    onFocus = (e) => {
        if (this.selection) {
            const change = this.state.editorState.change().select(this.selection);
            this.onChange(change);
            delete this.selection;
        }
    };

    focusComposer = () => {
        this.refs.editor.focus();
    };

    render() {
        const activeEditorState = this.state.originalEditorState || this.state.editorState;

        const className = classNames('mx_MessageComposer_input', {
            mx_MessageComposer_input_error: this.state.someCompletions === false,
        });

        return (
            <div className="mx_MessageComposer_input_wrapper" onClick={this.focusComposer}>
                <div className="mx_MessageComposer_autocomplete_wrapper">
                    <ReplyPreview />
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
                         title={this.state.isRichTextEnabled ? _t("Markdown is disabled") : _t("Markdown is enabled")}
                         src={`img/button-md-${!this.state.isRichTextEnabled}.png`} />
                    <Editor ref="editor"
                            dir="auto"
                            className="mx_MessageComposer_editor"
                            placeholder={this.props.placeholder}
                            value={this.state.editorState}
                            onChange={this.onChange}
                            onKeyDown={this.onKeyDown}
                            onPaste={this.onPaste}
                            onBlur={this.onBlur}
                            onFocus={this.onFocus}
                            renderNode={this.renderNode}
                            renderMark={this.renderMark}
                            // disable spell check for the placeholder because browsers don't like "unencrypted"
                            spellCheck={!this.state.editorState.document.isEmpty}
                            />
                </div>
            </div>
        );
    }
}
