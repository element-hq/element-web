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

var marked = require("marked");
marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false
});

import {Editor, EditorState, RichUtils, CompositeDecorator,
    convertFromRaw, convertToRaw, Modifier, EditorChangeType,
    getDefaultKeyBinding, KeyBindingUtil, ContentState} from 'draft-js';

import {stateToMarkdown} from 'draft-js-export-markdown';

var MatrixClientPeg = require("../../../MatrixClientPeg");
var SlashCommands = require("../../../SlashCommands");
var Modal = require("../../../Modal");
var MemberEntry = require("../../../TabCompleteEntries").MemberEntry;
var sdk = require('../../../index');

var dis = require("../../../dispatcher");
var KeyCode = require("../../../KeyCode");

import {contentStateToHTML, HTMLtoContentState, getScopedDecorator} from '../../../RichText';

const TYPING_USER_TIMEOUT = 10000, TYPING_SERVER_TIMEOUT = 30000;

function mdownToHtml(mdown) {
    var html = marked(mdown) || "";
    html = html.trim();
    // strip start and end <p> tags else you get 'orrible spacing
    if (html.indexOf("<p>") === 0) {
        html = html.substring("<p>".length);
    }
    if (html.lastIndexOf("</p>") === (html.length - "</p>".length)) {
        html = html.substring(0, html.length - "</p>".length);
    }
    return html;
}

/*
 * The textInput part of the MessageComposer
 */
export default class MessageComposerInput extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.onAction = this.onAction.bind(this);
        this.onInputClick = this.onInputClick.bind(this);

        this.state = {
            isRichtextEnabled: true,
            editorState: null
        };

        // bit of a hack, but we need to do this here since createEditorState needs isRichtextEnabled
        this.state.editorState = this.createEditorState();
    }

    static getKeyBinding(e: SyntheticKeyboardEvent): string {
        // C-m => Toggles between rich text and markdown modes
        if(e.keyCode == 77 && KeyBindingUtil.isCtrlKeyCommand(e)) {
            return 'toggle-mode';
        }

        return getDefaultKeyBinding(e);
    }

    /**
     * "Does the right thing" to create an EditorState, based on:
     * - whether we've got rich text mode enabled
     * - contentState was passed in
     */
    createEditorState(contentState: ?ContentState): EditorState {
        let func = contentState ? EditorState.createWithContent : EditorState.createEmpty;
        let args = contentState ? [contentState] : [];
        if(this.state.isRichtextEnabled) {
            args.push(getScopedDecorator(this.props));
        }
        return func.apply(null, args);
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

            init: function (element, roomId) {
                this.roomId = roomId;
                this.element = element;
                this.position = -1;
                var storedData = window.sessionStorage.getItem(
                    "history_" + roomId
                );
                if (storedData) {
                    this.data = JSON.parse(storedData);
                }
                if (this.roomId) {
                    this.setLastTextEntry();
                }
            },

            push: function (text) {
                // store a message in the sent history
                this.data.unshift(text);
                window.sessionStorage.setItem(
                    "history_" + this.roomId,
                    JSON.stringify(this.data)
                );
                // reset history position
                this.position = -1;
                this.originalText = null;
            },

            // move in the history. Returns true if we managed to move.
            next: function (offset) {
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

            saveLastTextEntry: function () {
                // save the currently entered text in order to restore it later.
                // NB: This isn't 'originalText' because we want to restore
                // sent history items too!
                let contentJSON = JSON.stringify(convertToRaw(component.state.editorState.getCurrentContent()));
                window.sessionStorage.setItem("input_" + this.roomId, contentJSON);
            },

            setLastTextEntry: function () {
                let contentJSON = window.sessionStorage.getItem("input_" + this.roomId);
                if (contentJSON) {
                    let content = convertFromRaw(JSON.parse(contentJSON));
                    component.setState({
                        editorState: component.createEditorState(content)
                    });
                }
            }
        };
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.sentHistory.init(
            this.refs.editor,
            this.props.room.roomId
        );
        // this is disabled for now, since https://github.com/matrix-org/matrix-react-sdk/pull/296 will land soon
        // if (this.props.tabComplete) {
        //     this.props.tabComplete.setEditor(this.refs.editor);
        // }
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        this.sentHistory.saveLastTextEntry();
    }

    onAction(payload) {
        var editor = this.refs.editor;

        switch (payload.action) {
            case 'focus_composer':
                editor.focus();
                break;

            // TODO change this so we insert a complete user alias

            case 'insert_displayname':
                if (this.state.editorState.getCurrentContent().hasText()) {
                    console.log(payload);
                    let contentState = Modifier.replaceText(
                        this.state.editorState.getCurrentContent(),
                        this.state.editorState.getSelection(),
                        payload.displayname
                    );
                    this.setState({
                        editorState: EditorState.push(this.state.editorState, contentState, 'insert-characters')
                    });
                    editor.focus();
                }
                break;
        }
    }

    onKeyDown(ev) {
        if (ev.keyCode === KeyCode.UP || ev.keyCode === KeyCode.DOWN) {
            var oldSelectionStart = this.refs.textarea.selectionStart;
            // Remember the keyCode because React will recycle the synthetic event
            var keyCode = ev.keyCode;
            // set a callback so we can see if the cursor position changes as
            // a result of this event. If it doesn't, we cycle history.
            setTimeout(() => {
                if (this.refs.textarea.selectionStart == oldSelectionStart) {
                    this.sentHistory.next(keyCode === KeyCode.UP ? 1 : -1);
                }
            }, 0);
        }
    }

    onEnter(ev) {
        var contentText = this.refs.textarea.value;

        // bodge for now to set markdown state on/off. We probably want a separate
        // area for "local" commands which don't hit out to the server.
        // if (contentText.indexOf("/markdown") === 0) {
        //     ev.preventDefault();
        //     this.refs.textarea.value = '';
        //     if (contentText.indexOf("/markdown on") === 0) {
        //         this.markdownEnabled = true;
        //     }
        //     else if (contentText.indexOf("/markdown off") === 0) {
        //         this.markdownEnabled = false;
        //     }
        //     else {
        //         const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        //         Modal.createDialog(ErrorDialog, {
        //             title: "Unknown command",
        //             description: "Usage: /markdown on|off"
        //         });
        //     }
        //     return;
        // }

        var cmd = SlashCommands.processInput(this.props.room.roomId, contentText);
        if (cmd) {
            ev.preventDefault();
            if (!cmd.error) {
                this.refs.textarea.value = '';
            }
            if (cmd.promise) {
                cmd.promise.done(function() {
                    console.log("Command success.");
                }, function(err) {
                    console.error("Command failure: %s", err);
                    var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Server error",
                        description: err.message
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
            return;
        }

        var isEmote = /^\/me( |$)/i.test(contentText);
        var sendMessagePromise;

        if (isEmote) {
            contentText = contentText.substring(4);
        }
        else if (contentText[0] === '/') {
            contentText = contentText.substring(1);
        }

        var htmlText;
        if (this.markdownEnabled && (htmlText = mdownToHtml(contentText)) !== contentText) {
            sendMessagePromise = isEmote ?
                MatrixClientPeg.get().sendHtmlEmote(this.props.room.roomId, contentText, htmlText) :
                MatrixClientPeg.get().sendHtmlMessage(this.props.room.roomId, contentText, htmlText);
        }
        else {
            sendMessagePromise = isEmote ?
                MatrixClientPeg.get().sendEmoteMessage(this.props.room.roomId, contentText) :
                MatrixClientPeg.get().sendTextMessage(this.props.room.roomId, contentText);
        }


        this.refs.textarea.value = '';
        ev.preventDefault();
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

    onInputClick(ev) {
        this.refs.editor.focus();
    }

    onChange(editorState) {
        this.setState({editorState});

        if(editorState.getCurrentContent().hasText()) {
            this.onTypingActivity()
        } else {
            this.onFinishedTyping();
        }
    }

    handleKeyCommand(command) {
        if(command === 'toggle-mode') {
            this.setState({
                isRichtextEnabled: !this.state.isRichtextEnabled
            });

            if(!this.state.isRichtextEnabled) {
                let html = mdownToHtml(this.state.editorState.getCurrentContent().getPlainText());
                this.setState({
                    editorState: this.createEditorState(HTMLtoContentState(html))
                });
            } else {
                let markdown = stateToMarkdown(this.state.editorState.getCurrentContent());
                let contentState = ContentState.createFromText(markdown);
                this.setState({
                    editorState: this.createEditorState(contentState)
                });
            }

            return true;
        }

        let newState = RichUtils.handleKeyCommand(this.state.editorState, command);
        if (newState) {
            this.onChange(newState);
            return true;
        }
        return false;
    }

    handleReturn(ev) {
        if(ev.shiftKey)
            return false;

        const contentState = this.state.editorState.getCurrentContent();
        if(!contentState.hasText())
            return true;

        let contentText = contentState.getPlainText(), contentHTML;

        if(this.state.isRichtextEnabled) {
            contentHTML = contentStateToHTML(contentState);
        } else {
            contentHTML = mdownToHtml(contentText);
        }

        this.sentHistory.push(contentHTML);
        let sendMessagePromise = MatrixClientPeg.get().sendHtmlMessage(this.props.room.roomId, contentText, contentHTML);

        sendMessagePromise.done(() => {
            dis.dispatch({
                action: 'message_sent'
            });
        }, () => {
            dis.dispatch({
                action: 'message_send_failed'
            });
        });

        this.setState({
            editorState: this.createEditorState()
        });

        return true;
    }

    render() {
        let className = "mx_MessageComposer_input";

        if(this.state.isRichtextEnabled) {
            className += " mx_MessageComposer_input_rte"; // placeholder indicator for RTE mode
        }


        return (
            <div className={className}
                 onClick={ this.onInputClick }>
                <Editor ref="editor"
                        placeholder="Type a message…"
                        editorState={this.state.editorState}
                        onChange={(state) => this.onChange(state)}
                        keyBindingFn={MessageComposerInput.getKeyBinding}
                        handleKeyCommand={(command) => this.handleKeyCommand(command)}
                        handleReturn={ev => this.handleReturn(ev)} />
            </div>
        );
    }
};

MessageComposerInput.propTypes = {
    tabComplete: React.PropTypes.any,

    // a callback which is called when the height of the composer is
    // changed due to a change in content.
    onResize: React.PropTypes.func,

    // js-sdk Room object
    room: React.PropTypes.object.isRequired
};
