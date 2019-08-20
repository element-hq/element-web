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
import dis from '../../../dispatcher';
import EditorModel from '../../../editor/model';
import {getCaretOffsetAndText} from '../../../editor/dom';
import {htmlSerializeIfNeeded, textSerialize} from '../../../editor/serialize';
import {PartCreator} from '../../../editor/parts';
import {MatrixClient} from 'matrix-js-sdk';
import BasicMessageComposer from "./BasicMessageComposer";
import ReplyPreview from "./ReplyPreview";
import RoomViewStore from '../../../stores/RoomViewStore';
import ReplyThread from "../elements/ReplyThread";
import {parseEvent} from '../../../editor/deserialize';
import {findEditableEvent} from '../../../utils/EventUtils';
import ComposerHistoryManager from "../../../ComposerHistoryManager";

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

function createMessageContent(model, permalinkCreator) {
    const repliedToEvent = RoomViewStore.getQuotingEvent();

    const body = textSerialize(model);
    const content = {
        msgtype: "m.text",
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

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.model = null;
        this._editorRef = null;
        this.currentlyComposedEditorState = null;
    }

    _setEditorRef = ref => {
        this._editorRef = ref;
    };

    _onKeyDown = (event) => {
        const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
        if (event.key === "Enter" && !hasModifier) {
            this._sendMessage();
            event.preventDefault();
        } else if (event.key === "ArrowUp") {
            this.onVerticalArrow(event, true);
        } else if (event.key === "ArrowDown") {
            this.onVerticalArrow(event, false);
        }
    }

    onVerticalArrow(e, up) {
        if (e.ctrlKey || e.shiftKey || e.metaKey) return;

        const shouldSelectHistory = e.altKey;
        const shouldEditLastMessage = !e.altKey && up && !RoomViewStore.getQuotingEvent();

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

    _sendMessage() {
        const isReply = !!RoomViewStore.getQuotingEvent();
        const {roomId} = this.props.room;
        const content = createMessageContent(this.model, this.props.permalinkCreator);
        this.context.matrixClient.sendMessage(roomId, content);
        this.sendHistoryManager.save(this.model);
        this.model.reset([]);
        this._editorRef.clearUndoHistory();

        if (isReply) {
            // Clear reply_to_event as we put the message into the queue
            // if the send fails, retry will handle resending.
            dis.dispatch({
                action: 'reply_to_event',
                event: null,
            });
        }
        dis.dispatch({action: 'focus_composer'});
    }

    componentWillUnmount() {
        const sel = document.getSelection();
        const {caret} = getCaretOffsetAndText(this._editorRef, sel);
        const parts = this.model.serializeParts();
        this.props.editState.setEditorState(caret, parts);
        dis.unregister(this.dispatcherRef);
    }

    componentWillMount() {
        const partCreator = new PartCreator(this.props.room, this.context.matrixClient);
        this.model = new EditorModel([], partCreator);
        this.dispatcherRef = dis.register(this.onAction);
        this.sendHistoryManager = new ComposerHistoryManager(this.props.room.roomId, 'mx_slate_composer_history_');
    }

    onAction = (payload) => {
        switch (payload.action) {
            case 'reply_to_event':
            case 'focus_composer':
                this._editorRef.focus();
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
        const member = this.props.room.getMember(userId);
        const displayName = member ?
            member.rawDisplayName : userId;
        const userPillPart = this.model.partCreator.userPill(displayName, userId);
        this.model.insertPartsAt([userPillPart], this._editorRef.getCaret());
        // refocus on composer, as we just clicked "Mention"
        this._editorRef.focus();
    }

    _insertQuotedMessage(event) {
        const {partCreator} = this.model;
        const quoteParts = parseEvent(event, partCreator, { isQuotedMessage: true });
        // add two newlines
        quoteParts.push(partCreator.newline());
        quoteParts.push(partCreator.newline());
        this.model.insertPartsAt(quoteParts, {offset: 0});
        // refocus on composer, as we just clicked "Quote"
        this._editorRef.focus();
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
                />
            </div>
        );
    }
}
