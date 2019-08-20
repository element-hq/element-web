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

    // Clear reply_to_event as we put the message into the queue
    // if the send fails, retry will handle resending.
    dis.dispatch({
        action: 'reply_to_event',
        event: null,
    });
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
    }

    _setEditorRef = ref => {
        this._editorRef = ref;
    };

    _onKeyDown = (event) => {
        if (event.metaKey || event.altKey || event.shiftKey) {
            return;
        }
        if (event.key === "Enter") {
            this._sendMessage();
            event.preventDefault();
        }
    }

    _sendMessage() {
        const {roomId} = this.props.room;
        this.context.matrixClient.sendMessage(roomId, createMessageContent(this.model, this.props.permalinkCreator));
        this.model.reset([]);
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
    }

    onAction = (payload) => {
        switch (payload.action) {
            case 'reply_to_event':
            case 'focus_composer':
                this._editorRef.focus();
                break;
            case 'insert_mention': {
                const userId = payload.user_id;
                const member = this.props.room.getMember(userId);
                const displayName = member ?
                    member.rawDisplayName : payload.user_id;
                const userPillPart = this.model.partCreator.userPill(displayName, userId);
                this.model.insertPartAt(userPillPart, this._editorRef.getCaret());
                break;
            }
        }
    };

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
