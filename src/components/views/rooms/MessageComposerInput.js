/*
Copyright 2015, 2016 OpenMarket Ltd

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
import type SyntheticKeyboardEvent from 'react/lib/SyntheticKeyboardEvent';

import {Editor, EditorState, RichUtils, CompositeDecorator, Modifier,
    getDefaultKeyBinding, KeyBindingUtil, ContentState, ContentBlock, SelectionState,
    Entity} from 'draft-js';

import classNames from 'classnames';
import escape from 'lodash/escape';
import Promise from 'bluebird';

import MatrixClientPeg from '../../../MatrixClientPeg';
import type {MatrixClient} from 'matrix-js-sdk/lib/matrix';
import SlashCommands from '../../../SlashCommands';
import KeyCode from '../../../KeyCode';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Analytics from '../../../Analytics';

import dis from '../../../dispatcher';
import UserSettingsStore from '../../../UserSettingsStore';

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

import {asciiRegexp, shortnameToUnicode, emojioneList, asciiList, mapUnicodeToShort} from 'emojione';
const EMOJI_SHORTNAMES = Object.keys(emojioneList);
const EMOJI_UNICODE_TO_SHORTNAME = mapUnicodeToShort();
const REGEX_EMOJI_WHITESPACE = new RegExp('(?:^|\\s)(' + asciiRegexp + ')\\s$');

const TYPING_USER_TIMEOUT = 10000, TYPING_SERVER_TIMEOUT = 30000;

const ZWS_CODE = 8203;
const ZWS = String.fromCharCode(ZWS_CODE); // zero width space
function stateToMarkdown(state) {
    return __stateToMarkdown(state)
        .replace(
            ZWS, // draft-js-export-markdown adds these
            ''); // this is *not* a zero width space, trust me :)
}

function onSendMessageFailed(err, room) {
    // XXX: temporary logging to try to diagnose
    // https://github.com/vector-im/riot-web/issues/3148
    console.log('MessageComposer got send failure: ' + err.name + '('+err+')');
    if (err.name === "UnknownDeviceError") {
        dis.dispatch({
            action: 'unknown_device_error',
            err: err,
            room: room,
        });
    }
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
        onResize: React.PropTypes.func,

        // js-sdk Room object
        room: React.PropTypes.object.isRequired,

        // called with current plaintext content (as a string) whenever it changes
        onContentChanged: React.PropTypes.func,

        onInputStateChanged: React.PropTypes.func,
    };

    static getKeyBinding(ev: SyntheticKeyboardEvent): string {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        let ctrlCmdOnly;
        if (isMac) {
            ctrlCmdOnly = ev.metaKey && !ev.altKey && !ev.ctrlKey && !ev.shiftKey;
        } else {
            ctrlCmdOnly = ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
        }

        // Restrict a subset of key bindings to ONLY having ctrl/meta* pressed and
        // importantly NOT having alt, shift, meta/ctrl* pressed. draft-js does not
        // handle this in `getDefaultKeyBinding` so we do it ourselves here.
        //
        // * if macOS, read second option
        const ctrlCmdCommand = {
            // C-m => Toggles between rich text and markdown modes
            [KeyCode.KEY_M]: 'toggle-mode',
            [KeyCode.KEY_B]: 'bold',
            [KeyCode.KEY_I]: 'italic',
            [KeyCode.KEY_U]: 'underline',
            [KeyCode.KEY_J]: 'code',
            [KeyCode.KEY_O]: 'split-block',
        }[ev.keyCode];

        if (ctrlCmdCommand) {
            if (!ctrlCmdOnly) {
                return null;
            }
            return ctrlCmdCommand;
        }

        // Handle keys such as return, left and right arrows etc.
        return getDefaultKeyBinding(ev);
    }

    static getBlockStyle(block: ContentBlock): ?string {
        if (block.getType() === 'strikethrough') {
            return 'mx_Markdown_STRIKETHROUGH';
        }

        return null;
    }

    client: MatrixClient;
    autocomplete: Autocomplete;
    historyManager: ComposerHistoryManager;

    constructor(props, context) {
        super(props, context);
        this.onAction = this.onAction.bind(this);
        this.handleReturn = this.handleReturn.bind(this);
        this.handleKeyCommand = this.handleKeyCommand.bind(this);
        this.onEditorContentChanged = this.onEditorContentChanged.bind(this);
        this.onUpArrow = this.onUpArrow.bind(this);
        this.onDownArrow = this.onDownArrow.bind(this);
        this.onTab = this.onTab.bind(this);
        this.onEscape = this.onEscape.bind(this);
        this.setDisplayedCompletion = this.setDisplayedCompletion.bind(this);
        this.onMarkdownToggleClicked = this.onMarkdownToggleClicked.bind(this);
        this.onTextPasted = this.onTextPasted.bind(this);

        const isRichtextEnabled = UserSettingsStore.getSyncedSetting('MessageComposerInput.isRichTextEnabled', false);

        Analytics.setRichtextMode(isRichtextEnabled);

        this.state = {
            // whether we're in rich text or markdown mode
            isRichtextEnabled,

            // the currently displayed editor state (note: this is always what is modified on input)
            editorState: this.createEditorState(
                isRichtextEnabled,
                MessageComposerStore.getContentState(this.props.room.roomId),
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
    }

    findLinkEntities(contentState: ContentState, contentBlock: ContentBlock, callback) {
        contentBlock.findEntityRanges(
            (character) => {
                const entityKey = character.getEntity();
                return (
                    entityKey !== null &&
                    contentState.getEntity(entityKey).getType() === 'LINK'
                );
            }, callback,
        );
    }

    /*
     * "Does the right thing" to create an EditorState, based on:
     * - whether we've got rich text mode enabled
     * - contentState was passed in
     */
    createEditorState(richText: boolean, contentState: ?ContentState): EditorState {
        const decorators = richText ? RichText.getScopedRTDecorators(this.props) :
                RichText.getScopedMDDecorators(this.props);
        const shouldShowPillAvatar = !UserSettingsStore.getSyncedSetting("Pill.shouldHidePillAvatar", false);
        decorators.push({
            strategy: this.findLinkEntities.bind(this),
            component: (entityProps) => {
                const Pill = sdk.getComponent('elements.Pill');
                const {url} = entityProps.contentState.getEntity(entityProps.entityKey).getData();
                if (Pill.isPillUrl(url)) {
                    return <Pill
                        url={url}
                        room={this.props.room}
                        offsetKey={entityProps.offsetKey}
                        shouldShowPillAvatar={shouldShowPillAvatar}
                    />;
                }

                return (
                    <a href={url} data-offset-key={entityProps.offsetKey}>
                        {entityProps.children}
                    </a>
                );
            },
        });
        const compositeDecorator = new CompositeDecorator(decorators);

        let editorState = null;
        if (contentState) {
            editorState = EditorState.createWithContent(contentState, compositeDecorator);
        } else {
            editorState = EditorState.createEmpty(compositeDecorator);
        }

        return EditorState.moveFocusToEnd(editorState);
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
        let contentState = this.state.editorState.getCurrentContent();

        switch (payload.action) {
            case 'focus_composer':
                editor.focus();
                break;
            case 'insert_mention': {
                // Pretend that we've autocompleted this user because keeping two code
                // paths for inserting a user pill is not fun
                const selection = this.state.editorState.getSelection();
                const member = this.props.room.getMember(payload.user_id);
                const completion = member ?
                    member.rawDisplayName.replace(' (IRC)', '') : payload.user_id;
                this.setDisplayedCompletion({
                    completion,
                    selection,
                    href: `https://matrix.to/#/${payload.user_id}`,
                    suffix: selection.getStartOffset() === 0 ? ': ' : ' ',
                });
            }
                break;
            case 'quote': {
                /// XXX: Not doing rich-text quoting from formatted-body because draft-js
                /// has regressed such that when links are quoted, errors are thrown. See
                /// https://github.com/vector-im/riot-web/issues/4756.
                let body = escape(payload.text);
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
            clearTimeout(this.servrTypingTimer);
            this.serverTypingTimer = null;
        }
    }

    sendTyping(isTyping) {
        if (UserSettingsStore.getSyncedSetting('dontSendTypingNotifications', false)) return;
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

    // Called by Draft to change editor contents
    onEditorContentChanged = (editorState: EditorState) => {
        editorState = RichText.attachImmutableEntitiesToEmoji(editorState);

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

        // Automatic replacement of plaintext emoji to Unicode emoji
        if (UserSettingsStore.getSyncedSetting('MessageComposerInput.autoReplaceEmoji', false)) {
            // The first matched group includes just the matched plaintext emoji
            const emojiMatch = REGEX_EMOJI_WHITESPACE.exec(text.slice(0, currentStartOffset));
            if(emojiMatch) {
                // plaintext -> hex unicode
                const emojiUc = asciiList[emojiMatch[1]];
                // hex unicode -> shortname -> actual unicode
                const unicodeEmoji = shortnameToUnicode(EMOJI_UNICODE_TO_SHORTNAME[emojiUc]);
                const newContentState = Modifier.replaceText(
                    editorState.getCurrentContent(),
                    currentSelection.merge({
                        anchorOffset: currentStartOffset - emojiMatch[1].length - 1,
                        focusOffset: currentStartOffset,
                    }),
                    unicodeEmoji,
                );
                editorState = EditorState.push(
                    editorState,
                    newContentState,
                    'insert-characters',
                );
                editorState = EditorState.forceSelection(editorState, newContentState.getSelectionAfter());
            }
        }

        /* Since a modification was made, set originalEditorState to null, since newState is now our original */
        this.setState({
            editorState,
            originalEditorState: null,
        });
    };

    /**
     * We're overriding setState here because it's the most convenient way to monitor changes to the editorState.
     * Doing it using a separate function that calls setState is a possibility (and was the old approach), but that
     * approach requires a callback and an extra setState whenever trying to set multiple state properties.
     *
     * @param state
     * @param callback
     */
    setState(state, callback) {
        if (state.editorState != null) {
            state.editorState = RichText.attachImmutableEntitiesToEmoji(
                state.editorState);

            // Hide the autocomplete if the cursor location changes but the plaintext
            // content stays the same. We don't hide if the pt has changed because the
            // autocomplete will probably have different completions to show.
            if (
                !state.editorState.getSelection().equals(
                    this.state.editorState.getSelection()
                )
                && state.editorState.getCurrentContent().getPlainText() ===
                this.state.editorState.getCurrentContent().getPlainText()
            ) {
                this.autocomplete.hide();
            }

            if (state.editorState.getCurrentContent().hasText()) {
                this.onTypingActivity();
            } else {
                this.onFinishedTyping();
            }

            // Record the editor state for this room so that it can be retrieved after
            // switching to another room and back
            dis.dispatch({
                action: 'content_state',
                room_id: this.props.room.roomId,
                content_state: state.editorState.getCurrentContent(),
            });

            if (!state.hasOwnProperty('originalEditorState')) {
                state.originalEditorState = null;
            }
        }

        super.setState(state, () => {
            if (callback != null) {
                callback();
            }

            const textContent = this.state.editorState.getCurrentContent().getPlainText();
            const selection = RichText.selectionStateToTextOffsets(
                this.state.editorState.getSelection(),
                this.state.editorState.getCurrentContent().getBlocksAsArray());
            if (this.props.onContentChanged) {
                this.props.onContentChanged(textContent, selection);
            }

            // Scroll to the bottom of the editor if the cursor is on the last line of the
            // composer. For some reason the editor won't scroll automatically if we paste
            // blocks of text in or insert newlines.
            if (textContent.slice(selection.start).indexOf("\n") === -1) {
                this.refs.editor.refs.editor.scrollTop = this.refs.editor.refs.editor.scrollHeight;
            }
        });
    }

    enableRichtext(enabled: boolean) {
        if (enabled === this.state.isRichtextEnabled) return;

        let contentState = null;
        if (enabled) {
            const md = new Markdown(this.state.editorState.getCurrentContent().getPlainText());
            contentState = RichText.htmlToContentState(md.toHTML());
        } else {
            let markdown = RichText.stateToMarkdown(this.state.editorState.getCurrentContent());
            if (markdown[markdown.length - 1] === '\n') {
                markdown = markdown.substring(0, markdown.length - 1); // stateToMarkdown tacks on an extra newline (?!?)
            }
            contentState = ContentState.createFromText(markdown);
        }

        Analytics.setRichtextMode(enabled);

        this.setState({
            editorState: this.createEditorState(enabled, contentState),
            isRichtextEnabled: enabled,
        });
        UserSettingsStore.setSyncedSetting('MessageComposerInput.isRichTextEnabled', enabled);
    }

    handleKeyCommand = (command: string): boolean => {
        if (command === 'toggle-mode') {
            this.enableRichtext(!this.state.isRichtextEnabled);
            return true;
        }
        let newState: ?EditorState = null;

        // Draft handles rich text mode commands by default but we need to do it ourselves for Markdown.
        if (this.state.isRichtextEnabled) {
            // These are block types, not handled by RichUtils by default.
            const blockCommands = ['code-block', 'blockquote', 'unordered-list-item', 'ordered-list-item'];
            const currentBlockType = RichUtils.getCurrentBlockType(this.state.editorState);

            const shouldToggleBlockFormat = (
                command === 'backspace' ||
                command === 'split-block'
            ) && currentBlockType !== 'unstyled';

            if (blockCommands.includes(command)) {
                newState = RichUtils.toggleBlockType(this.state.editorState, command);
            } else if (command === 'strike') {
                // this is the only inline style not handled by Draft by default
                newState = RichUtils.toggleInlineStyle(this.state.editorState, 'STRIKETHROUGH');
            } else if (shouldToggleBlockFormat) {
                const currentStartOffset = this.state.editorState.getSelection().getStartOffset();
                const currentEndOffset = this.state.editorState.getSelection().getEndOffset();
                if (currentStartOffset === 0 && currentEndOffset === 0) {
                    // Toggle current block type (setting it to 'unstyled')
                    newState = RichUtils.toggleBlockType(this.state.editorState, currentBlockType);
                }
            }
        } else {
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

            // Returns a function that collapses a selectionState to its end and moves it by offset
            const collapseAndOffsetSelection = (selectionState, offset) => {
                const key = selectionState.getEndKey();
                return new SelectionState({
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

        if (newState == null) {
            newState = RichUtils.handleKeyCommand(this.state.editorState, command);
        }

        if (newState != null) {
            this.setState({editorState: newState});
            return true;
        }

        return false;
    }

    onTextPasted(text: string, html?: string) {
        const currentSelection = this.state.editorState.getSelection();
        const currentContent = this.state.editorState.getCurrentContent();

        let contentState = null;
        if (html && this.state.isRichtextEnabled) {
            contentState = Modifier.replaceWithFragment(
                currentContent,
                currentSelection,
                RichText.htmlToContentState(html).getBlockMap(),
            );
        } else {
            contentState = Modifier.replaceText(currentContent, currentSelection, text);
        }

        let newEditorState = EditorState.push(this.state.editorState, contentState, 'insert-characters');

        newEditorState = EditorState.forceSelection(newEditorState, contentState.getSelectionAfter());
        this.onEditorContentChanged(newEditorState);
        return true;
    }

    handleReturn(ev) {
        if (ev.shiftKey) {
            this.onEditorContentChanged(RichUtils.insertSoftNewline(this.state.editorState));
            return true;
        }

        const currentBlockType = RichUtils.getCurrentBlockType(this.state.editorState);
        if(
            ['code-block', 'blockquote', 'unordered-list-item', 'ordered-list-item']
            .includes(currentBlockType)
        ) {
            // By returning false, we allow the default draft-js key binding to occur,
            // which in this case invokes "split-block". This creates a new block of the
            // same type, allowing the user to delete it with backspace.
            // See handleKeyCommand (when command === 'backspace')
            return false;
        }

        const contentState = this.state.editorState.getCurrentContent();
        if (!contentState.hasText()) {
            return true;
        }


        let contentText = contentState.getPlainText(), contentHTML;

        // Strip MD user (tab-completed) mentions to preserve plaintext mention behaviour.
        // We have to do this now as opposed to after calculating the contentText for MD
        // mode because entity positions may not be maintained when using
        // md.toPlaintext().
        // Unfortunately this means we lose mentions in history when in MD mode. This
        // would be fixed if history was stored as contentState.
        contentText = this.removeMDLinks(contentState, ['@']);

        // Some commands (/join) require pills to be replaced with their text content
        const commandText = this.removeMDLinks(contentState, ['#']);
        const cmd = SlashCommands.processInput(this.props.room.roomId, commandText);
        if (cmd) {
            if (!cmd.error) {
                this.setState({
                    editorState: this.createEditorState(),
                });
            }
            if (cmd.promise) {
                cmd.promise.then(function() {
                    console.log("Command success.");
                }, function(err) {
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

        if (this.state.isRichtextEnabled) {
            // We should only send HTML if any block is styled or contains inline style
            let shouldSendHTML = false;
            const blocks = contentState.getBlocksAsArray();
            if (blocks.some((block) => block.getType() !== 'unstyled')) {
                shouldSendHTML = true;
            } else {
                const characterLists = blocks.map((block) => block.getCharacterList());
                // For each block of characters, determine if any inline styles are applied
                // and if yes, send HTML
                characterLists.forEach((characters) => {
                    const numberOfStylesForCharacters = characters.map(
                        (character) => character.getStyle().toArray().length,
                    ).toArray();
                    // If any character has more than 0 inline styles applied, send HTML
                    if (numberOfStylesForCharacters.some((styles) => styles > 0)) {
                        shouldSendHTML = true;
                    }
                });
            }
            if (!shouldSendHTML) {
                const hasLink = blocks.some((block) => {
                    return block.getCharacterList().filter((c) => {
                        const entityKey = c.getEntity();
                        return entityKey && contentState.getEntity(entityKey).getType() === 'LINK';
                    }).size > 0;
                });
                shouldSendHTML = hasLink;
            }
            if (shouldSendHTML) {
                contentHTML = HtmlUtils.processHtmlForSending(
                    RichText.contentStateToHTML(contentState),
                );
            }
        } else {
            // Use the original contentState because `contentText` has had mentions
            // stripped and these need to end up in contentHTML.

            // Replace all Entities of type `LINK` with markdown link equivalents.
            // TODO: move this into `Markdown` and do the same conversion in the other
            // two places (toggling from MD->RT mode and loading MD history into RT mode)
            // but this can only be done when history includes Entities.
            const pt = contentState.getBlocksAsArray().map((block) => {
                let blockText = block.getText();
                let offset = 0;
                this.findLinkEntities(contentState, block, (start, end) => {
                    const entity = contentState.getEntity(block.getEntityAt(start));
                    if (entity.getType() !== 'LINK') {
                        return;
                    }
                    const text = blockText.slice(offset + start, offset + end);
                    const url = entity.getData().url;
                    const mdLink = `[${text}](${url})`;
                    blockText = blockText.slice(0, offset + start) + mdLink + blockText.slice(offset + end);
                    offset += mdLink.length - text.length;
                });
                return blockText;
            }).join('\n');

            const md = new Markdown(pt);
            if (md.isPlainText()) {
                contentText = md.toPlaintext();
            } else {
                contentHTML = md.toHTML();
            }
        }

        let sendHtmlFn = this.client.sendHtmlMessage;
        let sendTextFn = this.client.sendTextMessage;

        this.historyManager.save(
            contentState,
            this.state.isRichtextEnabled ? 'html' : 'markdown',
        );

        if (contentText.startsWith('/me')) {
            contentText = contentText.substring(4);
            // bit of a hack, but the alternative would be quite complicated
            if (contentHTML) contentHTML = contentHTML.replace(/\/me ?/, '');
            sendHtmlFn = this.client.sendHtmlEmote;
            sendTextFn = this.client.sendEmoteMessage;
        }

        let sendMessagePromise;
        if (contentHTML) {
            sendMessagePromise = sendHtmlFn.call(
                this.client, this.props.room.roomId, contentText, contentHTML,
            );
        } else {
            sendMessagePromise = sendTextFn.call(this.client, this.props.room.roomId, contentText);
        }

        sendMessagePromise.done((res) => {
            dis.dispatch({
                action: 'message_sent',
            });
        }, (e) => onSendMessageFailed(e, this.props.room));

        this.setState({
            editorState: this.createEditorState(),
        });

        return true;
    }

    onUpArrow = (e) => {
        this.onVerticalArrow(e, true);
    };

    onDownArrow = (e) => {
        this.onVerticalArrow(e, false);
    };

    onVerticalArrow = (e, up) => {
        if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
            return;
        }

        // Select history only if we are not currently auto-completing
        if (this.autocomplete.state.completionList.length === 0) {
            // Don't go back in history if we're in the middle of a multi-line message
            const selection = this.state.editorState.getSelection();
            const blockKey = selection.getStartKey();
            const firstBlock = this.state.editorState.getCurrentContent().getFirstBlock();
            const lastBlock = this.state.editorState.getCurrentContent().getLastBlock();

            let canMoveUp = false;
            let canMoveDown = false;
            if (blockKey === firstBlock.getKey()) {
                canMoveUp = selection.getStartOffset() === selection.getEndOffset() &&
                    selection.getStartOffset() === 0;
            }

            if (blockKey === lastBlock.getKey()) {
                canMoveDown = selection.getStartOffset() === selection.getEndOffset() &&
                    selection.getStartOffset() === lastBlock.getText().length;
            }

            if ((up && !canMoveUp) || (!up && !canMoveDown)) return;

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

        const newContent = this.historyManager.getItem(delta, this.state.isRichtextEnabled ? 'html' : 'markdown');
        if (!newContent) return false;
        let editorState = EditorState.push(
            this.state.editorState,
            newContent,
            'insert-characters',
        );

        // Move selection to the end of the selected history
        let newSelection = SelectionState.createEmpty(newContent.getLastBlock().getKey());
        newSelection = newSelection.merge({
            focusOffset: newContent.getLastBlock().getLength(),
            anchorOffset: newContent.getLastBlock().getLength(),
        });
        editorState = EditorState.forceSelection(editorState, newSelection);

        this.setState({editorState});
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
        const completion = up ? this.autocomplete.onUpArrow() : this.autocomplete.onDownArrow();
        return this.setDisplayedCompletion(completion);
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
                // This is a workaround from https://github.com/facebook/draft-js/issues/458
                // Due to the way we swap editorStates, Draft does not rerender at times
                editorState = EditorState.forceSelection(editorState,
                    editorState.getSelection());
                this.setState({editorState});

            }
            return false;
        }

        const {range = null, completion = '', href = null, suffix = ''} = displayedCompletion;
        let contentState = activeEditorState.getCurrentContent();

        let entityKey;
        if (href) {
            contentState = contentState.createEntity('LINK', 'IMMUTABLE', {
                url: href,
                isCompletion: true,
            });
            entityKey = contentState.getLastCreatedEntityKey();
        }

        let selection;
        if (range) {
            selection = RichText.textOffsetsToSelectionState(
                range, contentState.getBlocksAsArray(),
            );
        } else {
            selection = activeEditorState.getSelection();
        }

        contentState = Modifier.replaceText(contentState, selection, completion, null, entityKey);

        // Move the selection to the end of the block
        const afterSelection = contentState.getSelectionAfter();
        if (suffix) {
            contentState = Modifier.replaceText(contentState, afterSelection, suffix);
        }

        let editorState = EditorState.push(activeEditorState, contentState, 'insert-characters');
        editorState = EditorState.forceSelection(editorState, contentState.getSelectionAfter());
        this.setState({editorState, originalEditorState: activeEditorState});

        // for some reason, doing this right away does not update the editor :(
        // setTimeout(() => this.refs.editor.focus(), 50);
        return true;
    };

    onFormatButtonClicked(name: "bold" | "italic" | "strike" | "code" | "underline" | "quote" | "bullet" | "numbullet", e) {
        e.preventDefault(); // don't steal focus from the editor!
        const command = {
                code: 'code-block',
                quote: 'blockquote',
                bullet: 'unordered-list-item',
                numbullet: 'ordered-list-item',
            }[name] || name;
        this.handleKeyCommand(command);
    }

    /* returns inline style and block type of current SelectionState so MessageComposer can render formatting
     buttons. */
    getSelectionInfo(editorState: EditorState) {
        const styleName = {
            BOLD: 'bold',
            ITALIC: 'italic',
            STRIKETHROUGH: 'strike',
            UNDERLINE: 'underline',
        };

        const originalStyle = editorState.getCurrentInlineStyle().toArray();
        const style = originalStyle
            .map((style) => styleName[style] || null)
            .filter((styleName) => !!styleName);

        const blockName = {
            'code-block': 'code',
            'blockquote': 'quote',
            'unordered-list-item': 'bullet',
            'ordered-list-item': 'numbullet',
        };
        const originalBlockType = editorState.getCurrentContent()
            .getBlockForKey(editorState.getSelection().getStartKey())
            .getType();
        const blockType = blockName[originalBlockType] || null;

        return {
            style,
            blockType,
        };
    }

    getAutocompleteQuery(contentState: ContentState) {
        // Don't send markdown links to the autocompleter
        return this.removeMDLinks(contentState, ['@', '#']);
    }

    removeMDLinks(contentState: ContentState, prefixes: string[]) {
        const plaintext = contentState.getPlainText();
        if (!plaintext) return '';
        return plaintext.replace(REGEX_MATRIXTO_MARKDOWN_GLOBAL,
        (markdownLink, text, resource, prefix, offset) => {
            if (!prefixes.includes(prefix)) return markdownLink;
            // Calculate the offset relative to the current block that the offset is in
            let sum = 0;
            const blocks = contentState.getBlocksAsArray();
            let block;
            for (let i = 0; i < blocks.length; i++) {
                block = blocks[i];
                sum += block.getLength();
                if (sum > offset) {
                    sum -= block.getLength();
                    break;
                }
            }
            offset -= sum;

            const entityKey = block.getEntityAt(offset);
            const entity = entityKey ? contentState.getEntity(entityKey) : null;
            if (entity && entity.getData().isCompletion) {
                // This is a completed mention, so do not insert MD link, just text
                return text;
            } else {
                // This is either a MD link that was typed into the composer or another
                // type of pill (e.g. room pill)
                return markdownLink;
            }
        });
    }

    onMarkdownToggleClicked = (e) => {
        e.preventDefault(); // don't steal focus from the editor!
        this.handleKeyCommand('toggle-mode');
    };

    render() {
        const activeEditorState = this.state.originalEditorState || this.state.editorState;

        // From https://github.com/facebook/draft-js/blob/master/examples/rich/rich.html#L92
        // If the user changes block type before entering any text, we can
        // either style the placeholder or hide it.
        let hidePlaceholder = false;
        const contentState = activeEditorState.getCurrentContent();
        if (!contentState.hasText()) {
            if (contentState.getBlockMap().first().getType() !== 'unstyled') {
                hidePlaceholder = true;
            }
        }

        const className = classNames('mx_MessageComposer_input', {
            mx_MessageComposer_input_empty: hidePlaceholder,
            mx_MessageComposer_input_error: this.state.someCompletions === false,
        });

        const content = activeEditorState.getCurrentContent();
        const selection = RichText.selectionStateToTextOffsets(activeEditorState.getSelection(),
            activeEditorState.getCurrentContent().getBlocksAsArray());

        return (
            <div className="mx_MessageComposer_input_wrapper">
                <div className="mx_MessageComposer_autocomplete_wrapper">
                    <Autocomplete
                        ref={(e) => this.autocomplete = e}
                        onConfirm={this.setDisplayedCompletion}
                        query={this.getAutocompleteQuery(content)}
                        selection={selection}/>
                </div>
                <div className={className}>
                    <img className="mx_MessageComposer_input_markdownIndicator mx_filterFlipColor"
                         onMouseDown={this.onMarkdownToggleClicked}
                         title={ this.state.isRichtextEnabled ? _t("Markdown is disabled") : _t("Markdown is enabled")}
                         src={`img/button-md-${!this.state.isRichtextEnabled}.png`} />
                    <Editor ref="editor"
                            dir="auto"
                            placeholder={this.props.placeholder}
                            editorState={this.state.editorState}
                            onChange={this.onEditorContentChanged}
                            blockStyleFn={MessageComposerInput.getBlockStyle}
                            keyBindingFn={MessageComposerInput.getKeyBinding}
                            handleKeyCommand={this.handleKeyCommand}
                            handleReturn={this.handleReturn}
                            handlePastedText={this.onTextPasted}
                            handlePastedFiles={this.props.onFilesPasted}
                            stripPastedStyles={!this.state.isRichtextEnabled}
                            onTab={this.onTab}
                            onUpArrow={this.onUpArrow}
                            onDownArrow={this.onDownArrow}
                            onEscape={this.onEscape}
                            spellCheck={true}/>
                </div>
            </div>
        );
    }
}

MessageComposerInput.propTypes = {
    // a callback which is called when the height of the composer is
    // changed due to a change in content.
    onResize: React.PropTypes.func,

    // js-sdk Room object
    room: React.PropTypes.object.isRequired,

    // called with current plaintext content (as a string) whenever it changes
    onContentChanged: React.PropTypes.func,

    onFilesPasted: React.PropTypes.func,

    onInputStateChanged: React.PropTypes.func,
};
