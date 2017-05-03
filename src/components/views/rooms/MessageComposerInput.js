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

import {Editor, EditorState, RichUtils, CompositeDecorator,
    convertFromRaw, convertToRaw, Modifier, EditorChangeType,
    getDefaultKeyBinding, KeyBindingUtil, ContentState, ContentBlock, SelectionState} from 'draft-js';

import {stateToMarkdown as __stateToMarkdown} from 'draft-js-export-markdown';
import classNames from 'classnames';
import escape from 'lodash/escape';
import Q from 'q';

import MatrixClientPeg from '../../../MatrixClientPeg';
import type {MatrixClient} from 'matrix-js-sdk/lib/matrix';
import SlashCommands from '../../../SlashCommands';
import Modal from '../../../Modal';
import sdk from '../../../index';

import dis from '../../../dispatcher';
import KeyCode from '../../../KeyCode';
import UserSettingsStore from '../../../UserSettingsStore';

import * as RichText from '../../../RichText';
import * as HtmlUtils from '../../../HtmlUtils';
import Autocomplete from './Autocomplete';
import {Completion} from "../../../autocomplete/Autocompleter";
import Markdown from '../../../Markdown';
import {onSendMessageFailed} from './MessageComposerInputOld';

const TYPING_USER_TIMEOUT = 10000, TYPING_SERVER_TIMEOUT = 30000;

const KEY_M = 77;

const ZWS_CODE = 8203;
const ZWS = String.fromCharCode(ZWS_CODE); // zero width space
function stateToMarkdown(state) {
    return __stateToMarkdown(state)
        .replace(
            ZWS, // draft-js-export-markdown adds these
            ''); // this is *not* a zero width space, trust me :)
}

/*
 * The textInput part of the MessageComposer
 */
export default class MessageComposerInput extends React.Component {
    static getKeyBinding(e: SyntheticKeyboardEvent): string {
        // C-m => Toggles between rich text and markdown modes
        if (e.keyCode === KEY_M && KeyBindingUtil.isCtrlKeyCommand(e)) {
            return 'toggle-mode';
        }

        return getDefaultKeyBinding(e);
    }

    static getBlockStyle(block: ContentBlock): ?string {
        if (block.getType() === 'strikethrough') {
            return 'mx_Markdown_STRIKETHROUGH';
        }

        return null;
    }

    client: MatrixClient;
    autocomplete: Autocomplete;

    constructor(props, context) {
        super(props, context);
        this.onAction = this.onAction.bind(this);
        this.handleReturn = this.handleReturn.bind(this);
        this.handleKeyCommand = this.handleKeyCommand.bind(this);
        this.handlePastedFiles = this.handlePastedFiles.bind(this);
        this.onEditorContentChanged = this.onEditorContentChanged.bind(this);
        this.setEditorState = this.setEditorState.bind(this);
        this.onUpArrow = this.onUpArrow.bind(this);
        this.onDownArrow = this.onDownArrow.bind(this);
        this.onTab = this.onTab.bind(this);
        this.onEscape = this.onEscape.bind(this);
        this.setDisplayedCompletion = this.setDisplayedCompletion.bind(this);
        this.onMarkdownToggleClicked = this.onMarkdownToggleClicked.bind(this);

        const isRichtextEnabled = UserSettingsStore.getSyncedSetting('MessageComposerInput.isRichTextEnabled', false);

        this.state = {
            // whether we're in rich text or markdown mode
            isRichtextEnabled,

            // the currently displayed editor state (note: this is always what is modified on input)
            editorState: null,

            // the original editor state, before we started tabbing through completions
            originalEditorState: null,
        };

        // bit of a hack, but we need to do this here since createEditorState needs isRichtextEnabled
        /* eslint react/no-direct-mutation-state:0 */
        this.state.editorState = this.createEditorState();

        this.client = MatrixClientPeg.get();
    }

    /*
     * "Does the right thing" to create an EditorState, based on:
     * - whether we've got rich text mode enabled
     * - contentState was passed in
     */
    createEditorState(richText: boolean, contentState: ?ContentState): EditorState {
        let decorators = richText ? RichText.getScopedRTDecorators(this.props) :
                                    RichText.getScopedMDDecorators(this.props),
            compositeDecorator = new CompositeDecorator(decorators);

        let editorState = null;
        if (contentState) {
            editorState = EditorState.createWithContent(contentState, compositeDecorator);
        } else {
            editorState = EditorState.createEmpty(compositeDecorator);
        }

        return EditorState.moveFocusToEnd(editorState);
    }

    componentWillMount() {
        const component = this;
        this.sentHistory = {
            // The list of typed messages. Index 0 is more recent
            data: [],
            // The position in data currently displayed
            position: -1,
            // The room the history is for.
            roomId: null,
            // The original text before they hit UP
            originalText: null,
            // The textarea element to set text to.
            element: null,

            init: function(element, roomId) {
                this.roomId = roomId;
                this.element = element;
                this.position = -1;
                var storedData = window.sessionStorage.getItem(
                    "mx_messagecomposer_history_" + roomId
                );
                if (storedData) {
                    this.data = JSON.parse(storedData);
                }
                if (this.roomId) {
                    this.setLastTextEntry();
                }
            },

            push: function(text) {
                // store a message in the sent history
                this.data.unshift(text);
                window.sessionStorage.setItem(
                    "mx_messagecomposer_history_" + this.roomId,
                    JSON.stringify(this.data)
                );
                // reset history position
                this.position = -1;
                this.originalText = null;
            },

            // move in the history. Returns true if we managed to move.
            next: function(offset) {
                if (this.position === -1) {
                    // user is going into the history, save the current line.
                    this.originalText = this.element.value;
                }
                else {
                    // user may have modified this line in the history; remember it.
                    this.data[this.position] = this.element.value;
                }

                if (offset > 0 && this.position === (this.data.length - 1)) {
                    // we've run out of history
                    return false;
                }

                // retrieve the next item (bounded).
                var newPosition = this.position + offset;
                newPosition = Math.max(-1, newPosition);
                newPosition = Math.min(newPosition, this.data.length - 1);
                this.position = newPosition;

                if (this.position !== -1) {
                    // show the message
                    this.element.value = this.data[this.position];
                }
                else if (this.originalText !== undefined) {
                    // restore the original text the user was typing.
                    this.element.value = this.originalText;
                }

                return true;
            },

            saveLastTextEntry: function() {
                // save the currently entered text in order to restore it later.
                // NB: This isn't 'originalText' because we want to restore
                // sent history items too!
                let contentJSON = JSON.stringify(convertToRaw(component.state.editorState.getCurrentContent()));
                window.sessionStorage.setItem("mx_messagecomposer_input_" + this.roomId, contentJSON);
            },

            setLastTextEntry: function() {
                let contentJSON = window.sessionStorage.getItem("mx_messagecomposer_input_" + this.roomId);
                if (contentJSON) {
                    let content = convertFromRaw(JSON.parse(contentJSON));
                    component.setEditorState(component.createEditorState(component.state.isRichtextEnabled, content));
                }
            },
        };
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.sentHistory.init(
            this.refs.editor,
            this.props.room.roomId
        );
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        this.sentHistory.saveLastTextEntry();
    }

    componentWillUpdate(nextProps, nextState) {
        // this is dirty, but moving all this state to MessageComposer is dirtier
        if (this.props.onInputStateChanged && nextState !== this.state) {
            const state = this.getSelectionInfo(nextState.editorState);
            state.isRichtextEnabled = nextState.isRichtextEnabled;
            this.props.onInputStateChanged(state);
        }
    }

    onAction(payload) {
        let editor = this.refs.editor;
        let contentState = this.state.editorState.getCurrentContent();

        switch (payload.action) {
            case 'focus_composer':
                editor.focus();
                break;

            // TODO change this so we insert a complete user alias

            case 'insert_displayname': {
                contentState = Modifier.replaceText(
                    contentState,
                    this.state.editorState.getSelection(),
                    `${payload.displayname}: `
                );
                let editorState = EditorState.push(this.state.editorState, contentState, 'insert-characters');
                editorState = EditorState.forceSelection(editorState, contentState.getSelectionAfter());
                this.onEditorContentChanged(editorState);
                editor.focus();
            }
            break;

            case 'quote': {
                let {body, formatted_body} = payload.event.getContent();
                formatted_body = formatted_body || escape(body);
                if (formatted_body) {
                    let content = RichText.HTMLtoContentState(`<blockquote>${formatted_body}</blockquote>`);
                    if (!this.state.isRichtextEnabled) {
                        content = ContentState.createFromText(stateToMarkdown(content));
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
                    this.onEditorContentChanged(editorState);
                    editor.focus();
                }
            }
            break;
        }
    }

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
        var self = this;
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
            var self = this;
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
            this.isTyping, TYPING_SERVER_TIMEOUT
        ).done();
    }

    refreshTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    // Called by Draft to change editor contents, and by setEditorState
    onEditorContentChanged(editorState: EditorState, didRespondToUserInput: boolean = true) {
        editorState = RichText.attachImmutableEntitiesToEmoji(editorState);

        const contentChanged = Q.defer();
        /* If a modification was made, set originalEditorState to null, since newState is now our original */
        this.setState({
            editorState,
            originalEditorState: didRespondToUserInput ? null : this.state.originalEditorState,
        }, () => contentChanged.resolve());

        if (editorState.getCurrentContent().hasText()) {
            this.onTypingActivity();
        } else {
            this.onFinishedTyping();
        }

        if (this.props.onContentChanged) {
            const textContent = editorState.getCurrentContent().getPlainText();
            const selection = RichText.selectionStateToTextOffsets(editorState.getSelection(),
                editorState.getCurrentContent().getBlocksAsArray());

            this.props.onContentChanged(textContent, selection);
        }
        return contentChanged.promise;
    }

    setEditorState(editorState: EditorState) {
        return this.onEditorContentChanged(editorState, false);
    }

    enableRichtext(enabled: boolean) {
        let contentState = null;
        if (enabled) {
            const md = new Markdown(this.state.editorState.getCurrentContent().getPlainText());
            contentState = RichText.HTMLtoContentState(md.toHTML());
        } else {
            let markdown = stateToMarkdown(this.state.editorState.getCurrentContent());
            if (markdown[markdown.length - 1] === '\n') {
                markdown = markdown.substring(0, markdown.length - 1); // stateToMarkdown tacks on an extra newline (?!?)
            }
            contentState = ContentState.createFromText(markdown);
        }

        this.setEditorState(this.createEditorState(enabled, contentState)).then(() => {
            this.setState({
                isRichtextEnabled: enabled,
            });

            UserSettingsStore.setSyncedSetting('MessageComposerInput.isRichTextEnabled', enabled);
        });
    }

    handleKeyCommand(command: string): boolean {
        if (command === 'toggle-mode') {
            this.enableRichtext(!this.state.isRichtextEnabled);
            return true;
        }

        let newState: ?EditorState = null;

        // Draft handles rich text mode commands by default but we need to do it ourselves for Markdown.
        if (this.state.isRichtextEnabled) {
            // These are block types, not handled by RichUtils by default.
            const blockCommands = ['code-block', 'blockquote', 'unordered-list-item', 'ordered-list-item'];

            if (blockCommands.includes(command)) {
                this.setEditorState(RichUtils.toggleBlockType(this.state.editorState, command));
            } else if (command === 'strike') {
                // this is the only inline style not handled by Draft by default
                this.setEditorState(RichUtils.toggleInlineStyle(this.state.editorState, 'STRIKETHROUGH'));
            }
        } else {
            let contentState = this.state.editorState.getCurrentContent(),
                selection = this.state.editorState.getSelection();

            let modifyFn = {
                'bold': text => `**${text}**`,
                'italic': text => `*${text}*`,
                'underline': text => `_${text}_`, // there's actually no valid underline in Markdown, but *shrug*
                'strike': text => `~~${text}~~`,
                'code': text => `\`${text}\``,
                'blockquote': text => text.split('\n').map(line => `> ${line}\n`).join(''),
                'unordered-list-item': text => text.split('\n').map(line => `- ${line}\n`).join(''),
                'ordered-list-item': text => text.split('\n').map((line, i) => `${i+1}. ${line}\n`).join(''),
            }[command];

            if (modifyFn) {
                newState = EditorState.push(
                    this.state.editorState,
                    RichText.modifyText(contentState, selection, modifyFn),
                    'insert-characters'
                );
            }
        }

        if (newState == null) {
            newState = RichUtils.handleKeyCommand(this.state.editorState, command);
        }

        if (newState != null) {
            this.setEditorState(newState);
            return true;
        }

        return false;
    }

    handlePastedFiles(files) {
        this.props.onUploadFileSelected(files, true);
    }

    handleReturn(ev) {
        if (ev.shiftKey) {
            this.onEditorContentChanged(RichUtils.insertSoftNewline(this.state.editorState));
            return true;
        }

        const contentState = this.state.editorState.getCurrentContent();
        if (!contentState.hasText()) {
            return true;
        }


        let contentText = contentState.getPlainText(), contentHTML;

        var cmd = SlashCommands.processInput(this.props.room.roomId, contentText);
        if (cmd) {
            if (!cmd.error) {
                this.setState({
                    editorState: this.createEditorState()
                });
            }
            if (cmd.promise) {
                cmd.promise.then(function() {
                    console.log("Command success.");
                }, function(err) {
                    console.error("Command failure: %s", err);
                    var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Server error",
                        description: ((err && err.message) ? err.message : "Server unavailable, overloaded, or something else went wrong."),
                    });
                });
            }
            else if (cmd.error) {
                console.error(cmd.error);
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Command error",
                    description: cmd.error
                });
            }
            return true;
        }

        if (this.state.isRichtextEnabled) {
            contentHTML = HtmlUtils.stripParagraphs(
                RichText.contentStateToHTML(contentState)
            );
        } else {
            const md = new Markdown(contentText);
            if (md.isPlainText()) {
                contentText = md.toPlaintext();
            } else {
                contentHTML = md.toHTML();
            }
        }

        let sendHtmlFn = this.client.sendHtmlMessage;
        let sendTextFn = this.client.sendTextMessage;

        if (contentText.startsWith('/me')) {
            contentText = contentText.replace('/me ', '');
            // bit of a hack, but the alternative would be quite complicated
            if (contentHTML) contentHTML = contentHTML.replace('/me ', '');
            sendHtmlFn = this.client.sendHtmlEmote;
            sendTextFn = this.client.sendEmoteMessage;
        }

        // XXX: We don't actually seem to use this history?
        this.sentHistory.push(contentHTML || contentText);
        let sendMessagePromise;
        if (contentHTML) {
            sendMessagePromise = sendHtmlFn.call(
                this.client, this.props.room.roomId, contentText, contentHTML
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

        this.autocomplete.hide();

        return true;
    }

    async onUpArrow(e) {
        const completion = this.autocomplete.onUpArrow();
        if (completion != null) {
            e.preventDefault();
        }
        return await this.setDisplayedCompletion(completion);
    }

    async onDownArrow(e) {
        const completion = this.autocomplete.onDownArrow();
        e.preventDefault();
        return await this.setDisplayedCompletion(completion);
    }

    // tab and shift-tab are mapped to down and up arrow respectively
    async onTab(e) {
        e.preventDefault(); // we *never* want tab's default to happen, but we do want up/down sometimes
        const didTab = await (e.shiftKey ? this.onUpArrow : this.onDownArrow)(e);
        if (!didTab && this.autocomplete) {
            this.autocomplete.forceComplete().then(() => {
                this.onDownArrow(e);
            });
        }
    }

    onEscape(e) {
        e.preventDefault();
        if (this.autocomplete) {
            this.autocomplete.onEscape(e);
        }
        this.setDisplayedCompletion(null); // restore originalEditorState
    }

    /* If passed null, restores the original editor content from state.originalEditorState.
     * If passed a non-null displayedCompletion, modifies state.originalEditorState to compute new state.editorState.
     */
    async setDisplayedCompletion(displayedCompletion: ?Completion): boolean {
        const activeEditorState = this.state.originalEditorState || this.state.editorState;

        if (displayedCompletion == null) {
            if (this.state.originalEditorState) {
                this.setEditorState(this.state.originalEditorState);
            }
            return false;
        }

        const {range = {}, completion = ''} = displayedCompletion;

        let contentState = Modifier.replaceText(
            activeEditorState.getCurrentContent(),
            RichText.textOffsetsToSelectionState(range, activeEditorState.getCurrentContent().getBlocksAsArray()),
            completion
        );

        let editorState = EditorState.push(activeEditorState, contentState, 'insert-characters');
        editorState = EditorState.forceSelection(editorState, contentState.getSelectionAfter());
        const originalEditorState = activeEditorState;

        await this.setEditorState(editorState);
        this.setState({originalEditorState});

        // for some reason, doing this right away does not update the editor :(
        setTimeout(() => this.refs.editor.focus(), 50);
        return true;
    }

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
                .map(style => styleName[style] || null)
                .filter(styleName => !!styleName);

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

    onMarkdownToggleClicked(e) {
        e.preventDefault(); // don't steal focus from the editor!
        this.handleKeyCommand('toggle-mode');
    }

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
        });

        const content = activeEditorState.getCurrentContent();
        const contentText = content.getPlainText();
        const selection = RichText.selectionStateToTextOffsets(activeEditorState.getSelection(),
            activeEditorState.getCurrentContent().getBlocksAsArray());

        return (
            <div className="mx_MessageComposer_input_wrapper">
                <div className="mx_MessageComposer_autocomplete_wrapper">
                    <Autocomplete
                        ref={(e) => this.autocomplete = e}
                        onConfirm={this.setDisplayedCompletion}
                        query={contentText}
                        selection={selection} />
                </div>
                <div className={className}>
                    <img className="mx_MessageComposer_input_markdownIndicator mx_filterFlipColor"
                         onMouseDown={this.onMarkdownToggleClicked}
                         title={`Markdown is ${this.state.isRichtextEnabled ? 'disabled' : 'enabled'}`}
                         src={`img/button-md-${!this.state.isRichtextEnabled}.png`} />
                    <Editor ref="editor"
                            placeholder={this.props.placeholder}
                            editorState={this.state.editorState}
                            onChange={this.onEditorContentChanged}
                            blockStyleFn={MessageComposerInput.getBlockStyle}
                            keyBindingFn={MessageComposerInput.getKeyBinding}
                            handleKeyCommand={this.handleKeyCommand}
                            handleReturn={this.handleReturn}
                            handlePastedFiles={this.handlePastedFiles}
                            stripPastedStyles={!this.state.isRichtextEnabled}
                            onTab={this.onTab}
                            onUpArrow={this.onUpArrow}
                            onDownArrow={this.onDownArrow}
                            onEscape={this.onEscape}
                            spellCheck={true} />
                </div>
            </div>
        );
    }
}

MessageComposerInput.propTypes = {
    tabComplete: React.PropTypes.any,

    // a callback which is called when the height of the composer is
    // changed due to a change in content.
    onResize: React.PropTypes.func,

    // js-sdk Room object
    room: React.PropTypes.object.isRequired,

    // called with current plaintext content (as a string) whenever it changes
    onContentChanged: React.PropTypes.func,

    onUpArrow: React.PropTypes.func,

    onDownArrow: React.PropTypes.func,

    onUploadFileSelected: React.PropTypes.func,

    // attempts to confirm currently selected completion, returns whether actually confirmed
    tryComplete: React.PropTypes.func,

    onInputStateChanged: React.PropTypes.func,
};
