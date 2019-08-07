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
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import dis from '../../../dispatcher';
import EditorModel from '../../../editor/model';
import HistoryManager from '../../../editor/history';
import {setCaretPosition} from '../../../editor/caret';
import {getCaretOffsetAndText} from '../../../editor/dom';
import Autocomplete from '../rooms/Autocomplete';
import {autoCompleteCreator} from '../../../editor/parts';
import {renderModel} from '../../../editor/render';
import {Room} from 'matrix-js-sdk';

const IS_MAC = navigator.platform.indexOf("Mac") !== -1;

export default class BasicMessageEditor extends React.Component {
    static propTypes = {
        model: PropTypes.instanceOf(EditorModel).isRequired,
        room: PropTypes.instanceOf(Room).isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.state = {
            autoComplete: null,
        };
        this._editorRef = null;
        this._autocompleteRef = null;
        this._modifiedFlag = false;
    }

    _updateEditorState = (caret, inputType, diff) => {
        renderModel(this._editorRef, this.props.model);
        if (caret) {
            try {
                setCaretPosition(this._editorRef, this.props.model, caret);
            } catch (err) {
                console.error(err);
            }
        }
        this.setState({autoComplete: this.props.model.autoComplete});
        this.historyManager.tryPush(this.props.model, caret, inputType, diff);
    }

    _onInput = (event) => {
        this._modifiedFlag = true;
        const sel = document.getSelection();
        const {caret, text} = getCaretOffsetAndText(this._editorRef, sel);
        this.props.model.update(text, event.inputType, caret);
    }

    _insertText(textToInsert, inputType = "insertText") {
        const sel = document.getSelection();
        const {caret, text} = getCaretOffsetAndText(this._editorRef, sel);
        const newText = text.substr(0, caret.offset) + textToInsert + text.substr(caret.offset);
        caret.offset += textToInsert.length;
        this.props.model.update(newText, inputType, caret);
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
        const model = this.props.model;
        const modKey = IS_MAC ? event.metaKey : event.ctrlKey;
        let handled = false;
        // undo
        if (modKey && event.key === "z") {
            if (this.historyManager.canUndo()) {
                const {parts, caret} = this.historyManager.undo(this.props.model);
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                model.reset(parts, caret, "historyUndo");
            }
            handled = true;
        // redo
        } else if (modKey && event.key === "y") {
            if (this.historyManager.canRedo()) {
                const {parts, caret} = this.historyManager.redo();
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                model.reset(parts, caret, "historyRedo");
            }
            handled = true;
        // insert newline on Shift+Enter
        } else if (event.shiftKey && event.key === "Enter") {
            this._insertText("\n");
            handled = true;
        // autocomplete or enter to send below shouldn't have any modifier keys pressed.
        } else if (!(event.metaKey || event.altKey || event.shiftKey)) {
            if (model.autoComplete) {
                const autoComplete = model.autoComplete;
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
                handled = true;
            }
        }
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    _cancelEdit = () => {
        dis.dispatch({action: "edit_event", event: null});
        dis.dispatch({action: 'focus_composer'});
    }

    isModified() {
        return this._modifiedFlag;
    }

    _onAutoCompleteConfirm = (completion) => {
        this.props.model.autoComplete.onComponentConfirm(completion);
    }

    _onAutoCompleteSelectionChange = (completion) => {
        this.props.model.autoComplete.onComponentSelectionChange(completion);
    }

    componentWillUnmount() {
        this._editorRef.removeEventListener("input", this._onInput, true);
    }

    componentDidMount() {
        const model = this.props.model;
        model.setUpdateCallback(this._updateEditorState);
        const partCreator = model.partCreator;
        // TODO: does this allow us to get rid of EditorStateTransfer?
        // not really, but we could not serialize the parts, and just change the autoCompleter
        partCreator.setAutoCompleteCreator(autoCompleteCreator(
            () => this._autocompleteRef,
            query => this.setState({query}),
        ));
        this.historyManager = new HistoryManager(partCreator);
        // initial render of model
        this._updateEditorState(this._getInitialCaretPosition());
        // attach input listener by hand so React doesn't proxy the events,
        // as the proxied event doesn't support inputType, which we need.
        this._editorRef.addEventListener("input", this._onInput, true);
        this._editorRef.focus();
    }

    _getInitialCaretPosition() {
        let caretPosition;
        if (this.props.initialCaret) {
            // if restoring state from a previous editor,
            // restore caret position from the state
            const caret = this.props.initialCaret;
            caretPosition = this.props.model.positionForOffset(caret.offset, caret.atNodeEnd);
        } else {
            // otherwise, set it at the end
            caretPosition = this.props.model.getPositionAtEnd();
        }
        return caretPosition;
    }


    isCaretAtStart() {
        const {caret} = getCaretOffsetAndText(this._editorRef, document.getSelection());
        return caret.offset === 0;
    }

    isCaretAtEnd() {
        const {caret, text} = getCaretOffsetAndText(this._editorRef, document.getSelection());
        return caret.offset === text.length;
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
                    room={this.props.room}
                />
            </div>;
        }
        return <div className={this.props.className}>
                { autoComplete }
                <div
                    className="mx_MessageEditor_editor"
                    contentEditable="true"
                    tabIndex="1"
                    onKeyDown={this._onKeyDown}
                    ref={ref => this._editorRef = ref}
                    aria-label={_t("Edit message")}
                ></div>
            </div>;
    }
}
