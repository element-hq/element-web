/*
Copyright 2019 New Vector Ltd

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
import {getCaretOffset, setCaretPosition} from '../../../editor/caret';
import parseEvent from '../../../editor/parse-event';
import {MatrixEvent, MatrixClient} from 'matrix-js-sdk';

export default class MessageEditor extends React.Component {
    static propTypes = {
        // the latest event in this chain of replies
        event: PropTypes.instanceOf(MatrixEvent).isRequired,
        // called when the ReplyThread contents has changed, including EventTiles thereof
        // onHeightChanged: PropTypes.func.isRequired,
    };

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.model = new EditorModel(parseEvent(this.props.event));
        this.state = {
            parts: this.model.serializeParts(),
        };
        this._onCancelClicked = this._onCancelClicked.bind(this);
        this._onInput = this._onInput.bind(this);
    }

    _onInput(event) {
        const editor = event.target;
        const caretOffset = getCaretOffset(editor);
        const caret = this.model.update(editor.textContent, event.inputType, caretOffset);
        const parts = this.model.serializeParts();
        this.setState({parts}, () => {
            setCaretPosition(editor, caret);
        });
    }

    _onCancelClicked() {
        dis.dispatch({action: "edit_event", event: null});
    }

    render() {
        const parts = this.state.parts.map((p, i) => {
            const key = `${i}-${p.type}`;
            switch (p.type) {
                case "plain": return p.text;
                case "room-pill": return (<span key={key} className="room-pill">{p.text}</span>);
                case "user-pill": return (<span key={key} className="user-pill">{p.text}</span>);
            }
        });
        const modelOutput = JSON.stringify(this.state.parts, undefined, 2);
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div className="mx_MessageEditor">
                <div className="editor" contentEditable="true" tabIndex="1" suppressContentEditableWarning={true} onInput={this._onInput}>
                    {parts}
                </div>
                <div className="buttons">
                    <AccessibleButton onClick={this._onCancelClicked}>{_t("Cancel")}</AccessibleButton>
                </div>
                <code className="model">{modelOutput}</code>
            </div>;
    }
}
