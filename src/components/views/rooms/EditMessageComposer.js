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
import * as sdk from '../../../index';
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import dis from '../../../dispatcher/dispatcher';
import EditorModel from '../../../editor/model';
import {getCaretOffsetAndText} from '../../../editor/dom';
import {htmlSerializeIfNeeded, textSerialize, containsEmote, stripEmoteCommand} from '../../../editor/serialize';
import {findEditableEvent} from '../../../utils/EventUtils';
import {parseEvent} from '../../../editor/deserialize';
import {PartCreator} from '../../../editor/parts';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import classNames from 'classnames';
import {EventStatus} from 'matrix-js-sdk';
import BasicMessageComposer from "./BasicMessageComposer";
import {Key} from "../../../Keyboard";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

function _isReply(mxEvent) {
    const relatesTo = mxEvent.getContent()["m.relates_to"];
    const isReply = !!(relatesTo && relatesTo["m.in_reply_to"]);
    return isReply;
}

function getHtmlReplyFallback(mxEvent) {
    const html = mxEvent.getContent().formatted_body;
    if (!html) {
        return "";
    }
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    const mxReply = rootNode.querySelector("mx-reply");
    return (mxReply && mxReply.outerHTML) || "";
}

function getTextReplyFallback(mxEvent) {
    const body = mxEvent.getContent().body;
    const lines = body.split("\n").map(l => l.trim());
    if (lines.length > 2 && lines[0].startsWith("> ") && lines[1].length === 0) {
        return `${lines[0]}\n\n`;
    }
    return "";
}

function createEditContent(model, editedEvent) {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    const isReply = _isReply(editedEvent);
    let plainPrefix = "";
    let htmlPrefix = "";

    if (isReply) {
        plainPrefix = getTextReplyFallback(editedEvent);
        htmlPrefix = getHtmlReplyFallback(editedEvent);
    }

    const body = textSerialize(model);

    const newContent = {
        "msgtype": isEmote ? "m.emote" : "m.text",
        "body": body,
    };
    const contentBody = {
        msgtype: newContent.msgtype,
        body: `${plainPrefix} * ${body}`,
    };

    const formattedBody = htmlSerializeIfNeeded(model, {forceHTML: isReply});
    if (formattedBody) {
        newContent.format = "org.matrix.custom.html";
        newContent.formatted_body = formattedBody;
        contentBody.format = newContent.format;
        contentBody.formatted_body = `${htmlPrefix} * ${formattedBody}`;
    }

    return Object.assign({
        "m.new_content": newContent,
        "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": editedEvent.getId(),
        },
    }, contentBody);
}

export default class EditMessageComposer extends React.Component {
    static propTypes = {
        // the message event being edited
        editState: PropTypes.instanceOf(EditorStateTransfer).isRequired,
    };

    static contextType = MatrixClientContext;

    constructor(props, context) {
        super(props, context);
        this.model = null;
        this._editorRef = null;

        this.state = {
            saveDisabled: true,
        };
        this._createEditorModel();
    }

    _setEditorRef = ref => {
        this._editorRef = ref;
    };

    _getRoom() {
        return this.context.getRoom(this.props.editState.getEvent().getRoomId());
    }

    _onKeyDown = (event) => {
        // ignore any keypress while doing IME compositions
        if (this._editorRef.isComposing(event)) {
            return;
        }
        if (event.metaKey || event.altKey || event.shiftKey) {
            return;
        }
        if (event.key === Key.ENTER) {
            this._sendEdit();
            event.preventDefault();
        } else if (event.key === Key.ESCAPE) {
            this._cancelEdit();
        } else if (event.key === Key.ARROW_UP) {
            if (this._editorRef.isModified() || !this._editorRef.isCaretAtStart()) {
                return;
            }
            const previousEvent = findEditableEvent(this._getRoom(), false, this.props.editState.getEvent().getId());
            if (previousEvent) {
                dis.dispatch({action: 'edit_event', event: previousEvent});
                event.preventDefault();
            }
        } else if (event.key === Key.ARROW_DOWN) {
            if (this._editorRef.isModified() || !this._editorRef.isCaretAtEnd()) {
                return;
            }
            const nextEvent = findEditableEvent(this._getRoom(), true, this.props.editState.getEvent().getId());
            if (nextEvent) {
                dis.dispatch({action: 'edit_event', event: nextEvent});
            } else {
                dis.dispatch({action: 'edit_event', event: null});
                dis.dispatch({action: 'focus_composer'});
            }
            event.preventDefault();
        }
    }

    _cancelEdit = () => {
        dis.dispatch({action: "edit_event", event: null});
        dis.dispatch({action: 'focus_composer'});
    }

    _isContentModified(newContent) {
        // if nothing has changed then bail
        const oldContent = this.props.editState.getEvent().getContent();
        if (!this._editorRef.isModified() ||
            (oldContent["msgtype"] === newContent["msgtype"] && oldContent["body"] === newContent["body"] &&
            oldContent["format"] === newContent["format"] &&
            oldContent["formatted_body"] === newContent["formatted_body"])) {
            return false;
        }
        return true;
    }

    _sendEdit = () => {
        const editedEvent = this.props.editState.getEvent();
        const editContent = createEditContent(this.model, editedEvent);
        const newContent = editContent["m.new_content"];

        // If content is modified then send an updated event into the room
        if (this._isContentModified(newContent)) {
            const roomId = editedEvent.getRoomId();
            this._cancelPreviousPendingEdit();
            this.context.sendMessage(roomId, editContent);
            dis.dispatch({action: "message_sent"});
        }

        // close the event editing and focus composer
        dis.dispatch({action: "edit_event", event: null});
        dis.dispatch({action: 'focus_composer'});
    };

    _cancelPreviousPendingEdit() {
        const originalEvent = this.props.editState.getEvent();
        const previousEdit = originalEvent.replacingEvent();
        if (previousEdit && (
            previousEdit.status === EventStatus.QUEUED ||
            previousEdit.status === EventStatus.NOT_SENT
        )) {
            this.context.cancelPendingEvent(previousEdit);
        }
    }

    componentWillUnmount() {
        // store caret and serialized parts in the
        // editorstate so it can be restored when the remote echo event tile gets rendered
        // in case we're currently editing a pending event
        const sel = document.getSelection();
        let caret;
        if (sel.focusNode) {
            caret = getCaretOffsetAndText(this._editorRef, sel).caret;
        }
        const parts = this.model.serializeParts();
        // if caret is undefined because for some reason there isn't a valid selection,
        // then when mounting the editor again with the same editor state,
        // it will set the cursor at the end.
        this.props.editState.setEditorState(caret, parts);
    }

    _createEditorModel() {
        const {editState} = this.props;
        const room = this._getRoom();
        const partCreator = new PartCreator(room, this.context);
        let parts;
        if (editState.hasEditorState()) {
            // if restoring state from a previous editor,
            // restore serialized parts from the state
            parts = editState.getSerializedParts().map(p => partCreator.deserializePart(p));
        } else {
            // otherwise, parse the body of the event
            parts = parseEvent(editState.getEvent(), partCreator);
        }
        this.model = new EditorModel(parts, partCreator);
    }

    _getInitialCaretPosition() {
        const {editState} = this.props;
        let caretPosition;
        if (editState.hasEditorState() && editState.getCaret()) {
            // if restoring state from a previous editor,
            // restore caret position from the state
            const caret = editState.getCaret();
            caretPosition = this.model.positionForOffset(caret.offset, caret.atNodeEnd);
        } else {
            // otherwise, set it at the end
            caretPosition = this.model.getPositionAtEnd();
        }
        return caretPosition;
    }

    _onChange = () => {
        if (!this.state.saveDisabled || !this._editorRef || !this._editorRef.isModified()) {
            return;
        }

        this.setState({
            saveDisabled: false,
        });
    };

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (<div className={classNames("mx_EditMessageComposer", this.props.className)} onKeyDown={this._onKeyDown}>
            <BasicMessageComposer
                ref={this._setEditorRef}
                model={this.model}
                room={this._getRoom()}
                initialCaret={this.props.editState.getCaret()}
                label={_t("Edit message")}
                onChange={this._onChange}
            />
            <div className="mx_EditMessageComposer_buttons">
                <AccessibleButton kind="secondary" onClick={this._cancelEdit}>{_t("Cancel")}</AccessibleButton>
                <AccessibleButton kind="primary" onClick={this._sendEdit} disabled={this.state.saveDisabled}>
                    {_t("Save")}
                </AccessibleButton>
            </div>
        </div>);
    }
}
