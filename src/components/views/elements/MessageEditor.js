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
import Autocomplete from '../rooms/Autocomplete';
// import AutocompleteModel from '../../../editor/autocomplete';
import {PartCreator} from '../../../editor/parts';
import {renderModel, rerenderModel} from '../../../editor/render';
import {MatrixEvent, MatrixClient} from 'matrix-js-sdk';

export default class MessageEditor extends React.Component {
    static propTypes = {
        // the latest event in this chain of replies
        event: PropTypes.instanceOf(MatrixEvent).isRequired,
        // onHeightChanged: PropTypes.func.isRequired,
    };

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        const partCreator = new PartCreator(
            () => this._autocompleteRef,
            query => this.setState({query}),
        );
        this.model = new EditorModel(
            parseEvent(this.props.event),
            partCreator,
            this._updateEditorState,
        );
        const room = this.context.matrixClient.getRoom(this.props.event.getRoomId());
        this.state = {
            autoComplete: null,
            room,
        };
        this._editorRef = null;
        this._autocompleteRef = null;
    }

    _updateEditorState = (caret) => {
        const shouldRerender = false; //event.inputType === "insertFromDrop" || event.inputType === "insertFromPaste";
        if (shouldRerender) {
            rerenderModel(this._editorRef, this.model);
        } else {
            renderModel(this._editorRef, this.model);
        }
        if (caret) {
            setCaretPosition(this._editorRef, caret);
        }

        this.setState({autoComplete: this.model.autoComplete});
        const modelOutput = this._editorRef.parentElement.querySelector(".model");
        modelOutput.textContent = JSON.stringify(this.model.serializeParts(), undefined, 2);
    }

    _onInput = (event) => {
        const caretOffset = getCaretOffset(this._editorRef);
        this.model.update(this._editorRef.textContent, event.inputType, caretOffset);
    }

    _onKeyDown = (event) => {
        if (event.metaKey || event.altKey || event.shiftKey) {
            return;
        }
        if (!this.model.autoComplete) {
            return;
        }
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
    }

    _onCancelClicked = () => {
        dis.dispatch({action: "edit_event", event: null});
    }

    _collectEditorRef = (ref) => {
        this._editorRef = ref;
    }

    _collectAutocompleteRef = (ref) => {
        this._autocompleteRef = ref;
    }

    _onAutoCompleteConfirm = (completion) => {
        this.model.autoComplete.onComponentConfirm(completion);
    }

    _onAutoCompleteSelectionChange = (completion) => {
        this.model.autoComplete.onComponentSelectionChange(completion);
    }

    componentDidMount() {
        this._updateEditorState();
    }

    render() {
        // const parts = this.state.parts.map((p, i) => {
        //     const key = `${i}-${p.type}`;
        //     switch (p.type) {
        //         case "plain": return p.text;
        //         case "room-pill": return (<span key={key} className="room-pill">{p.text}</span>);
        //         case "user-pill": return (<span key={key} className="user-pill">{p.text}</span>);
        //     }
        // });
        // const modelOutput = JSON.stringify(this.state.parts, undefined, 2);
        let autoComplete;
        if (this.state.autoComplete) {
            const query = this.state.query;
            const queryLen = query.length;
            autoComplete = <div className="mx_MessageEditor_AutoCompleteWrapper">
                <Autocomplete
                    ref={this._collectAutocompleteRef}
                    query={query}
                    onConfirm={this._onAutoCompleteConfirm}
                    onSelectionChange={this._onAutoCompleteSelectionChange}
                    selection={{beginning: true, end: queryLen, start: queryLen}}
                    room={this.state.room}
                />
            </div>;
        }
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div className="mx_MessageEditor">
                { autoComplete }
                <div
                    className="editor"
                    contentEditable="true"
                    tabIndex="1"
                    // suppressContentEditableWarning={true}
                    onInput={this._onInput}
                    onKeyDown={this._onKeyDown}
                    ref={this._collectEditorRef}
                >
                </div>
                <div className="buttons">
                    <AccessibleButton onClick={this._onCancelClicked}>{_t("Cancel")}</AccessibleButton>
                </div>
                <code className="model"></code>
            </div>;
    }
}
