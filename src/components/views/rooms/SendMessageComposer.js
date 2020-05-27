/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import dis from '../../../dispatcher/dispatcher';
import EditorModel from '../../../editor/model';
import {
    htmlSerializeIfNeeded,
    textSerialize,
    containsEmote,
    stripEmoteCommand,
    unescapeMessage,
    startsWith,
    stripPrefix,
} from '../../../editor/serialize';
import {CommandPartCreator} from '../../../editor/parts';
import BasicMessageComposer from "./BasicMessageComposer";
import ReplyPreview from "./ReplyPreview";
import RoomViewStore from '../../../stores/RoomViewStore';
import ReplyThread from "../elements/ReplyThread";
import {parseEvent} from '../../../editor/deserialize';
import {findEditableEvent} from '../../../utils/EventUtils';
import SendHistoryManager from "../../../SendHistoryManager";
import {getCommand} from '../../../SlashCommands';
import * as sdk from '../../../index';
import Modal from '../../../Modal';
import {_t, _td} from '../../../languageHandler';
import ContentMessages from '../../../ContentMessages';
import {Key} from "../../../Keyboard";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import RateLimitedFunc from '../../../ratelimitedfunc';

function addReplyToMessageContent(content, repliedToEvent, permalinkCreator) {
    const replyContent = ReplyThread.makeReplyMixIn(repliedToEvent);
    Object.assign(content, replyContent);

    // Part of Replies fallback support - prepend the text we're sending
    // with the text we're replying to
    const nestedReply = ReplyThread.getNestedReplyText(repliedToEvent, permalinkCreator);
    if (nestedReply) {
        if (content.formatted_body) {
            content.formatted_body = nestedReply.html + content.formatted_body;
        }
        content.body = nestedReply.body + content.body;
    }
}

// exported for tests
export function createMessageContent(model, permalinkCreator) {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    if (startsWith(model, "//")) {
        model = stripPrefix(model, "/");
    }
    model = unescapeMessage(model);
    const repliedToEvent = RoomViewStore.getQuotingEvent();

    const body = textSerialize(model);
    const content = {
        msgtype: isEmote ? "m.emote" : "m.text",
        body: body,
    };
    const formattedBody = htmlSerializeIfNeeded(model, {forceHTML: !!repliedToEvent});
    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
    }

    if (repliedToEvent) {
        addReplyToMessageContent(content, repliedToEvent, permalinkCreator);
    }

    return content;
}

export default class SendMessageComposer extends React.Component {
    static propTypes = {
        room: PropTypes.object.isRequired,
        placeholder: PropTypes.string,
        permalinkCreator: PropTypes.object.isRequired,
    };

    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);
        this.model = null;
        this._editorRef = null;
        this.currentlyComposedEditorState = null;
        const cli = MatrixClientPeg.get();
        if (cli.isCryptoEnabled() && cli.isRoomEncrypted(this.props.room.roomId)) {
            this._prepareToEncrypt = new RateLimitedFunc(() => {
                cli.prepareToEncrypt(this.props.room);
            }, 60000);
        }
    }

    _setEditorRef = ref => {
        this._editorRef = ref;
    };

    _onKeyDown = (event) => {
        // ignore any keypress while doing IME compositions
        if (this._editorRef.isComposing(event)) {
            return;
        }
        const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
        if (event.key === Key.ENTER && !hasModifier) {
            this._sendMessage();
            event.preventDefault();
        } else if (event.key === Key.ARROW_UP) {
            this.onVerticalArrow(event, true);
        } else if (event.key === Key.ARROW_DOWN) {
            this.onVerticalArrow(event, false);
        } else if (this._prepareToEncrypt) {
            this._prepareToEncrypt();
        } else if (event.key === Key.ESCAPE) {
            dis.dispatch({
                action: 'reply_to_event',
                event: null,
            });
        }
    };

    onVerticalArrow(e, up) {
        // arrows from an initial-caret composer navigates recent messages to edit
        // ctrl-alt-arrows navigate send history
        if (e.shiftKey || e.metaKey) return;

        const shouldSelectHistory = e.altKey && e.ctrlKey;
        const shouldEditLastMessage = !e.altKey && !e.ctrlKey && up && !RoomViewStore.getQuotingEvent();

        if (shouldSelectHistory) {
            // Try select composer history
            const selected = this.selectSendHistory(up);
            if (selected) {
                // We're selecting history, so prevent the key event from doing anything else
                e.preventDefault();
            }
        } else if (shouldEditLastMessage) {
            // selection must be collapsed and caret at start
            if (this._editorRef.isSelectionCollapsed() && this._editorRef.isCaretAtStart()) {
                const editEvent = findEditableEvent(this.props.room, false);
                if (editEvent) {
                    // We're selecting history, so prevent the key event from doing anything else
                    e.preventDefault();
                    dis.dispatch({
                        action: 'edit_event',
                        event: editEvent,
                    });
                }
            }
        }
    }

    // we keep sent messages/commands in a separate history (separate from undo history)
    // so you can alt+up/down in them
    selectSendHistory(up) {
        const delta = up ? -1 : 1;
        // True if we are not currently selecting history, but composing a message
        if (this.sendHistoryManager.currentIndex === this.sendHistoryManager.history.length) {
            // We can't go any further - there isn't any more history, so nop.
            if (!up) {
                return;
            }
            this.currentlyComposedEditorState = this.model.serializeParts();
        } else if (this.sendHistoryManager.currentIndex + delta === this.sendHistoryManager.history.length) {
            // True when we return to the message being composed currently
            this.model.reset(this.currentlyComposedEditorState);
            this.sendHistoryManager.currentIndex = this.sendHistoryManager.history.length;
            return;
        }
        const serializedParts = this.sendHistoryManager.getItem(delta);
        if (serializedParts) {
            this.model.reset(serializedParts);
            this._editorRef.focus();
        }
    }

    _isSlashCommand() {
        const parts = this.model.parts;
        const firstPart = parts[0];
        if (firstPart) {
            if (firstPart.type === "command" && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
                return true;
            }
            // be extra resilient when somehow the AutocompleteWrapperModel or
            // CommandPartCreator fails to insert a command part, so we don't send
            // a command as a message
            if (firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")
                && (firstPart.type === "plain" || firstPart.type === "pill-candidate")) {
                return true;
            }
        }
        return false;
    }

    _getSlashCommand() {
        const commandText = this.model.parts.reduce((text, part) => {
            // use mxid to textify user pills in a command
            if (part.type === "user-pill") {
                return text + part.resourceId;
            }
            return text + part.text;
        }, "");
        return [getCommand(this.props.room.roomId, commandText), commandText];
    }

    async _runSlashCommand(fn) {
        const cmd = fn();
        let error = cmd.error;
        if (cmd.promise) {
            try {
                await cmd.promise;
            } catch (err) {
                error = err;
            }
        }
        if (error) {
            console.error("Command failure: %s", error);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            // assume the error is a server error when the command is async
            const isServerError = !!cmd.promise;
            const title = isServerError ? _td("Server error") : _td("Command error");

            let errText;
            if (typeof error === 'string') {
                errText = error;
            } else if (error.message) {
                errText = error.message;
            } else {
                errText = _t("Server unavailable, overloaded, or something else went wrong.");
            }

            Modal.createTrackedDialog(title, '', ErrorDialog, {
                title: _t(title),
                description: errText,
            });
        } else {
            console.log("Command success.");
        }
    }

    async _sendMessage() {
        if (this.model.isEmpty) {
            return;
        }

        let shouldSend = true;

        if (!containsEmote(this.model) && this._isSlashCommand()) {
            const [cmd, commandText] = this._getSlashCommand();
            if (cmd) {
                shouldSend = false;
                this._runSlashCommand(cmd);
            } else {
                // ask the user if their unknown command should be sent as a message
                const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                const {finished} = Modal.createTrackedDialog("Unknown command", "", QuestionDialog, {
                    title: _t("Unknown Command"),
                    description: <div>
                        <p>
                            { _t("Unrecognised command: %(commandText)s", {commandText}) }
                        </p>
                        <p>
                            { _t("You can use <code>/help</code> to list available commands. " +
                                "Did you mean to send this as a message?", {}, {
                                code: t => <code>{ t }</code>,
                            }) }
                        </p>
                        <p>
                            { _t("Hint: Begin your message with <code>//</code> to start it with a slash.", {}, {
                                code: t => <code>{ t }</code>,
                            }) }
                        </p>
                    </div>,
                    button: _t('Send as message'),
                });
                const [sendAnyway] = await finished;
                // if !sendAnyway bail to let the user edit the composer and try again
                if (!sendAnyway) return;
            }
        }

        if (shouldSend) {
            const isReply = !!RoomViewStore.getQuotingEvent();
            const {roomId} = this.props.room;
            const content = createMessageContent(this.model, this.props.permalinkCreator);
            this.context.sendMessage(roomId, content);
            if (isReply) {
                // Clear reply_to_event as we put the message into the queue
                // if the send fails, retry will handle resending.
                dis.dispatch({
                    action: 'reply_to_event',
                    event: null,
                });
            }
            dis.dispatch({action: "message_sent"});
        }

        this.sendHistoryManager.save(this.model);
        // clear composer
        this.model.reset([]);
        this._editorRef.clearUndoHistory();
        this._editorRef.focus();
        this._clearStoredEditorState();
    }

    componentDidMount() {
        this._editorRef.getEditableRootNode().addEventListener("paste", this._onPaste, true);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        this._editorRef.getEditableRootNode().removeEventListener("paste", this._onPaste, true);
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        const partCreator = new CommandPartCreator(this.props.room, this.context);
        const parts = this._restoreStoredEditorState(partCreator) || [];
        this.model = new EditorModel(parts, partCreator);
        this.dispatcherRef = dis.register(this.onAction);
        this.sendHistoryManager = new SendHistoryManager(this.props.room.roomId, 'mx_cider_composer_history_');
    }

    get _editorStateKey() {
        return `cider_editor_state_${this.props.room.roomId}`;
    }

    _clearStoredEditorState() {
        localStorage.removeItem(this._editorStateKey);
    }

    _restoreStoredEditorState(partCreator) {
        const json = localStorage.getItem(this._editorStateKey);
        if (json) {
            const serializedParts = JSON.parse(json);
            const parts = serializedParts.map(p => partCreator.deserializePart(p));
            return parts;
        }
    }

    _saveStoredEditorState = () => {
        if (this.model.isEmpty) {
            this._clearStoredEditorState();
        } else {
            localStorage.setItem(this._editorStateKey, JSON.stringify(this.model.serializeParts()));
        }
    }

    onAction = (payload) => {
        switch (payload.action) {
            case 'reply_to_event':
            case 'focus_composer':
                this._editorRef && this._editorRef.focus();
                break;
            case 'insert_mention':
                this._insertMention(payload.user_id);
                break;
            case 'quote':
                this._insertQuotedMessage(payload.event);
                break;
        }
    };

    _insertMention(userId) {
        const {model} = this;
        const {partCreator} = model;
        const member = this.props.room.getMember(userId);
        const displayName = member ?
            member.rawDisplayName : userId;
        const caret = this._editorRef.getCaret();
        const position = model.positionForOffset(caret.offset, caret.atNodeEnd);
        // index is -1 if there are no parts but we only care for if this would be the part in position 0
        const insertIndex = position.index > 0 ? position.index : 0;
        const parts = partCreator.createMentionParts(insertIndex, displayName, userId);
        model.transform(() => {
            const addedLen = model.insert(parts, position);
            return model.positionForOffset(caret.offset + addedLen, true);
        });
        // refocus on composer, as we just clicked "Mention"
        this._editorRef && this._editorRef.focus();
    }

    _insertQuotedMessage(event) {
        const {model} = this;
        const {partCreator} = model;
        const quoteParts = parseEvent(event, partCreator, { isQuotedMessage: true });
        // add two newlines
        quoteParts.push(partCreator.newline());
        quoteParts.push(partCreator.newline());
        model.transform(() => {
            const addedLen = model.insert(quoteParts, model.positionForOffset(0));
            return model.positionForOffset(addedLen, true);
        });
        // refocus on composer, as we just clicked "Quote"
        this._editorRef && this._editorRef.focus();
    }

    _onPaste = (event) => {
        const {clipboardData} = event;
        if (clipboardData.files.length) {
            // This actually not so much for 'files' as such (at time of writing
            // neither chrome nor firefox let you paste a plain file copied
            // from Finder) but more images copied from a different website
            // / word processor etc.
            ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(clipboardData.files), this.props.room.roomId, this.context,
            );
        }
    }

    render() {
        return (
            <div className="mx_SendMessageComposer" onClick={this.focusComposer} onKeyDown={this._onKeyDown}>
                <div className="mx_SendMessageComposer_overlayWrapper">
                    <ReplyPreview permalinkCreator={this.props.permalinkCreator} />
                </div>
                <BasicMessageComposer
                    ref={this._setEditorRef}
                    model={this.model}
                    room={this.props.room}
                    label={this.props.placeholder}
                    placeholder={this.props.placeholder}
                    onChange={this._saveStoredEditorState}
                />
            </div>
        );
    }
}
