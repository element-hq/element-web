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
import {setCaretPosition} from '../../../editor/caret';
import {getCaretOffsetAndText} from '../../../editor/dom';
import {htmlSerializeIfNeeded, textSerialize} from '../../../editor/serialize';
import {findEditableEvent} from '../../../utils/EventUtils';
import {parseEvent} from '../../../editor/deserialize';
import Autocomplete from '../rooms/Autocomplete';
import {PartCreator} from '../../../editor/parts';
import {renderModel} from '../../../editor/render';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import {MatrixClient} from 'matrix-js-sdk';
import classNames from 'classnames';

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
        this._hasModifications = false;
    }

    _getRoom() {
        return this.context.matrixClient.getRoom(this.props.editState.getEvent().getRoomId());
    }

    _updateEditorState = (caret) => {
        renderModel(this._editorRef, this.model);
        if (caret) {
            try {
                setCaretPosition(this._editorRef, this.model, caret);
            } catch (err) {
                console.error(err);
            }
        }
        this.setState({autoComplete: this.model.autoComplete});
    }

    _onInput = (event) => {
        this._hasModifications = true;
        const sel = document.getSelection();
        const {caret, text} = getCaretOffsetAndText(this._editorRef, sel);
        this.model.update(text, event.inputType, caret);
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
        // insert newline on Shift+Enter
        if (event.shiftKey && event.key === "Enter") {
            event.preventDefault(); // just in case the browser does support this
            document.execCommand("insertHTML", undefined, "\n");
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
            if (this._hasModifications || !this._isCaretAtStart()) {
                return;
            }
            const previousEvent = findEditableEvent(this._getRoom(), false, this.props.editState.getEvent().getId());
            if (previousEvent) {
                dis.dispatch({action: 'edit_event', event: previousEvent});
                event.preventDefault();
            }
        } else if (event.key === "ArrowDown") {
            if (this._hasModifications || !this._isCaretAtEnd()) {
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

    _isEmote() {
        const firstPart = this.model.parts[0];
        return firstPart && firstPart.type === "plain" && firstPart.text.startsWith("/me ");
    }

    _sendEdit = () => {
        const isEmote = this._isEmote();
        let model = this.model;
        if (isEmote) {
            // trim "/me "
            model = model.clone();
            model.removeText({index: 0, offset: 0}, 4);
        }
        const newContent = {
            "msgtype": isEmote ? "m.emote" : "m.text",
            "body": textSerialize(model),
        };
        const contentBody = {
            msgtype: newContent.msgtype,
            body: ` * ${newContent.body}`,
        };
        const formattedBody = htmlSerializeIfNeeded(model);
        if (formattedBody) {
            newContent.format = "org.matrix.custom.html";
            newContent.formatted_body = formattedBody;
            contentBody.format = newContent.format;
            contentBody.formatted_body = ` * ${newContent.formatted_body}`;
        }
        const content = Object.assign({
            "m.new_content": newContent,
            "m.relates_to": {
                "rel_type": "m.replace",
                "event_id": this.props.editState.getEvent().getId(),
            },
        }, contentBody);

        const roomId = this.props.editState.getEvent().getRoomId();
        this.context.matrixClient.sendMessage(roomId, content);

        dis.dispatch({action: "edit_event", event: null});
        dis.dispatch({action: 'focus_composer'});
    }

    _onAutoCompleteConfirm = (completion) => {
        this.model.autoComplete.onComponentConfirm(completion);
    }

    _onAutoCompleteSelectionChange = (completion) => {
        this.model.autoComplete.onComponentSelectionChange(completion);
    }

    componentWillUnmount() {
        const sel = document.getSelection();
        const {caret} = getCaretOffsetAndText(this._editorRef, sel);
        const parts = this.model.serializeParts();
        this.props.editState.setEditorState(caret, parts);
    }

    componentDidMount() {
        this.model = this._createEditorModel();
        // initial render of model
        this._updateEditorState();
        // initial caret position
        this._initializeCaret();
        this._editorRef.focus();
    }

    _createEditorModel() {
        const {editState} = this.props;
        const room = this._getRoom();
        const partCreator = new PartCreator(
            () => this._autocompleteRef,
            query => this.setState({query}),
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
            parts = parseEvent(editState.getEvent(), room, this.context.matrixClient);
        }

        return new EditorModel(
            parts,
            partCreator,
            this._updateEditorState,
        );
    }

    _initializeCaret() {
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
        setCaretPosition(this._editorRef, this.model, caretPosition);
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
                    onInput={this._onInput}
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
