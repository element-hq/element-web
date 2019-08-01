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
import sdk from '../../../index';
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import dis from '../../../dispatcher';
import EditorModel from '../../../editor/model';
import HistoryManager from '../../../editor/history';
import {setCaretPosition} from '../../../editor/caret';
import {getCaretOffsetAndText} from '../../../editor/dom';
import {htmlSerializeIfNeeded, textSerialize} from '../../../editor/serialize';
import {findEditableEvent} from '../../../utils/EventUtils';
import {parseEvent} from '../../../editor/deserialize';
import Autocomplete from '../rooms/Autocomplete';
import {PartCreator, autoCompleteCreator} from '../../../editor/parts';
import {renderModel} from '../../../editor/render';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import {MatrixClient} from 'matrix-js-sdk';
import classNames from 'classnames';
import {EventStatus} from 'matrix-js-sdk';

const IS_MAC = navigator.platform.indexOf("Mac") !== -1;

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

function _isEmote(model) {
    const firstPart = model.parts[0];
    return firstPart && firstPart.type === "plain" && firstPart.text.startsWith("/me ");
}

function createEditContent(model, editedEvent) {
    const isEmote = _isEmote(model);
    if (isEmote) {
        // trim "/me "
        model = model.clone();
        model.removeText({index: 0, offset: 0}, 4);
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
        "body": plainPrefix + body,
    };
    const contentBody = {
        msgtype: newContent.msgtype,
        body: `${plainPrefix} * ${body}`,
    };

    const formattedBody = htmlSerializeIfNeeded(model, {forceHTML: isReply});
    if (formattedBody) {
        newContent.format = "org.matrix.custom.html";
        newContent.formatted_body = htmlPrefix + formattedBody;
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

export default class MessageEditor extends React.Component {
    static propTypes = {
        // the message event being edited
        editState: PropTypes.instanceOf(EditorStateTransfer).isRequired,
    };

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        const room = this._getRoom();
        this.model = null;
        this.state = {
            autoComplete: null,
            room,
        };
        this._editorRef = null;
        this._autocompleteRef = null;
        this._modifiedFlag = false;
    }

    _getRoom() {
        return this.context.matrixClient.getRoom(this.props.editState.getEvent().getRoomId());
    }

    _updateEditorState = (caret, inputType, diff) => {
        renderModel(this._editorRef, this.model);
        if (caret) {
            try {
                setCaretPosition(this._editorRef, this.model, caret);
            } catch (err) {
                console.error(err);
            }
        }
        this.setState({autoComplete: this.model.autoComplete});
        this.historyManager.tryPush(this.model, caret, inputType, diff);
    }

    _onInput = (event) => {
        this._modifiedFlag = true;
        const sel = document.getSelection();
        const {caret, text} = getCaretOffsetAndText(this._editorRef, sel);
        this.model.update(text, event.inputType, caret);
    }

    _insertText(textToInsert, inputType = "insertText") {
        const sel = document.getSelection();
        const {caret, text} = getCaretOffsetAndText(this._editorRef, sel);
        const newText = text.substr(0, caret.offset) + textToInsert + text.substr(caret.offset);
        caret.offset += textToInsert.length;
        this.model.update(newText, inputType, caret);
    }

    _isCaretAtStart() {
        const {caret} = getCaretOffsetAndText(this._editorRef, document.getSelection());
        return caret.offset === 0;
    }

    _isCaretAtEnd() {
        const {caret, text} = getCaretOffsetAndText(this._editorRef, document.getSelection());
        return caret.offset === text.length;
    }

    _onKeyDown = (event) => {
        const modKey = IS_MAC ? event.metaKey : event.ctrlKey;
        // undo
        if (modKey && event.key === "z") {
            if (this.historyManager.canUndo()) {
                const {parts, caret} = this.historyManager.undo(this.model);
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                this.model.reset(parts, caret, "historyUndo");
            }
            event.preventDefault();
        }
        // redo
        if (modKey && event.key === "y") {
            if (this.historyManager.canRedo()) {
                const {parts, caret} = this.historyManager.redo();
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                this.model.reset(parts, caret, "historyRedo");
            }
            event.preventDefault();
        }
        // insert newline on Shift+Enter
        if (event.shiftKey && event.key === "Enter") {
            event.preventDefault(); // just in case the browser does support this
            this._insertText("\n");
            return;
        }
        // autocomplete or enter to send below shouldn't have any modifier keys pressed.
        if (event.metaKey || event.altKey || event.shiftKey) {
            return;
        }
        if (this.model.autoComplete) {
            const autoComplete = this.model.autoComplete;
            switch (event.key) {
                case "Enter":
                    autoComplete.onEnter(event); break;
                case "ArrowUp":
                    autoComplete.onUpArrow(event); break;
                case "ArrowDown":
                    autoComplete.onDownArrow(event); break;
                case "Tab":
                    autoComplete.onTab(event); break;
                case "Escape":
                    autoComplete.onEscape(event); break;
                default:
                    return; // don't preventDefault on anything else
            }
            event.preventDefault();
        } else if (event.key === "Enter") {
            this._sendEdit();
            event.preventDefault();
        } else if (event.key === "Escape") {
            this._cancelEdit();
        } else if (event.key === "ArrowUp") {
            if (this._modifiedFlag || !this._isCaretAtStart()) {
                return;
            }
            const previousEvent = findEditableEvent(this._getRoom(), false, this.props.editState.getEvent().getId());
            if (previousEvent) {
                dis.dispatch({action: 'edit_event', event: previousEvent});
                event.preventDefault();
            }
        } else if (event.key === "ArrowDown") {
            if (this._modifiedFlag || !this._isCaretAtEnd()) {
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

    _hasModifications(newContent) {
        // if nothing has changed then bail
        const oldContent = this.props.editState.getEvent().getContent();
        if (!this._modifiedFlag ||
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
        if (!this._hasModifications(newContent)) {
            return;
        }
        const roomId = editedEvent.getRoomId();
        this._cancelPreviousPendingEdit();
        this.context.matrixClient.sendMessage(roomId, editContent);

        dis.dispatch({action: "edit_event", event: null});
        dis.dispatch({action: 'focus_composer'});
    }

    _cancelPreviousPendingEdit() {
        const originalEvent = this.props.editState.getEvent();
        const previousEdit = originalEvent.replacingEvent();
        if (previousEdit && (
            previousEdit.status === EventStatus.QUEUED ||
            previousEdit.status === EventStatus.NOT_SENT
        )) {
            this.context.matrixClient.cancelPendingEvent(previousEdit);
        }
    }

    _onAutoCompleteConfirm = (completion) => {
        this.model.autoComplete.onComponentConfirm(completion);
    }

    _onAutoCompleteSelectionChange = (completion) => {
        this.model.autoComplete.onComponentSelectionChange(completion);
    }

    componentWillUnmount() {
        this._editorRef.removeEventListener("input", this._onInput, true);
        const sel = document.getSelection();
        const {caret} = getCaretOffsetAndText(this._editorRef, sel);
        const parts = this.model.serializeParts();
        this.props.editState.setEditorState(caret, parts);
    }

    componentDidMount() {
        this._createEditorModel();
        // initial render of model
        this._updateEditorState(this._getInitialCaretPosition());
        // attach input listener by hand so React doesn't proxy the events,
        // as the proxied event doesn't support inputType, which we need.
        this._editorRef.addEventListener("input", this._onInput, true);
        this._editorRef.focus();
    }

    _createEditorModel() {
        const {editState} = this.props;
        const room = this._getRoom();
        const partCreator = new PartCreator(
            autoCompleteCreator(() => this._autocompleteRef, query => this.setState({query})),
            room,
            this.context.matrixClient,
        );
        let parts;
        if (editState.hasEditorState()) {
            // if restoring state from a previous editor,
            // restore serialized parts from the state
            parts = editState.getSerializedParts().map(p => partCreator.deserializePart(p));
        } else {
            // otherwise, parse the body of the event
            parts = parseEvent(editState.getEvent(), partCreator);
        }

        this.historyManager = new HistoryManager(partCreator);
        this.model = new EditorModel(
            parts,
            partCreator,
            this._updateEditorState,
        );
    }

    _getInitialCaretPosition() {
        const {editState} = this.props;
        let caretPosition;
        if (editState.hasEditorState()) {
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

    render() {
        let autoComplete;
        if (this.state.autoComplete) {
            const query = this.state.query;
            const queryLen = query.length;
            autoComplete = <div className="mx_MessageEditor_AutoCompleteWrapper">
                <Autocomplete
                    ref={ref => this._autocompleteRef = ref}
                    query={query}
                    onConfirm={this._onAutoCompleteConfirm}
                    onSelectionChange={this._onAutoCompleteSelectionChange}
                    selection={{beginning: true, end: queryLen, start: queryLen}}
                    room={this.state.room}
                />
            </div>;
        }
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div className={classNames("mx_MessageEditor", this.props.className)}>
                { autoComplete }
                <div
                    className="mx_MessageEditor_editor"
                    contentEditable="true"
                    tabIndex="1"
                    onKeyDown={this._onKeyDown}
                    ref={ref => this._editorRef = ref}
                    aria-label={_t("Edit message")}
                ></div>
                <div className="mx_MessageEditor_buttons">
                    <AccessibleButton kind="secondary" onClick={this._cancelEdit}>{_t("Cancel")}</AccessibleButton>
                    <AccessibleButton kind="primary" onClick={this._sendEdit}>{_t("Save")}</AccessibleButton>
                </div>
            </div>;
    }
}
