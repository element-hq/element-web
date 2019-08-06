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
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import {MatrixClient} from 'matrix-js-sdk';
import BasicMessageComposer from "./BasicMessageComposer";
import { _t } from '../../../languageHandler';

function createMessageContent(model, editedEvent) {
    const body = textSerialize(model);
    const content = {
        msgtype: "m.text",
        body,
    };
    const formattedBody = htmlSerializeIfNeeded(model, {forceHTML: false});
    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
    }
    return content;
}

export default class SendMessageComposer extends React.Component {
    static propTypes = {
        // the message event being edited
        editState: PropTypes.instanceOf(EditorStateTransfer).isRequired,
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
        this.context.matrixClient.sendMessage(roomId, createMessageContent(this.model));
        this.model.reset([]);
        dis.dispatch({action: 'focus_composer'});
    }

    componentWillUnmount() {
        const sel = document.getSelection();
        const {caret} = getCaretOffsetAndText(this._editorRef, sel);
        const parts = this.model.serializeParts();
        this.props.editState.setEditorState(caret, parts);
    }

    componentWillMount() {
        const partCreator = new PartCreator(this.props.room, this.context.matrixClient);
        this.model = new EditorModel([], partCreator);
    }

    render() {
        // <div className="mx_MessageComposer_autocomplete_wrapper">
        // </div>
        //<ReplyPreview permalinkCreator={this.props.permalinkCreator} />
        return (
            <div className="mx_SendMessageComposer" onClick={this.focusComposer} onKeyDown={this._onKeyDown}>
                <BasicMessageComposer
                    ref={this._setEditorRef}
                    model={this.model}
                    room={this.props.room}
                    label={_t("Send message")}
                    placeholder={this.props.placeholder}
                />
            </div>
        );
    }
}
