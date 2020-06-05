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

import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import EditorModel from '../../../editor/model';
import HistoryManager from '../../../editor/history';
import {setSelection} from '../../../editor/caret';
import {
    formatRangeAsQuote,
    formatRangeAsCode,
    toggleInlineFormat,
    replaceRangeAndMoveCaret,
} from '../../../editor/operations';
import {getCaretOffsetAndText, getRangeForSelection} from '../../../editor/dom';
import Autocomplete, {generateCompletionDomId} from '../rooms/Autocomplete';
import {autoCompleteCreator} from '../../../editor/parts';
import {parsePlainTextMessage} from '../../../editor/deserialize';
import {renderModel} from '../../../editor/render';
import {Room} from 'matrix-js-sdk';
import TypingStore from "../../../stores/TypingStore";
import SettingsStore from "../../../settings/SettingsStore";
import EMOTICON_REGEX from 'emojibase-regex/emoticon';
import * as sdk from '../../../index';
import {Key} from "../../../Keyboard";
import {EMOTICON_TO_EMOJI} from "../../../emoji";
import {CommandCategories, CommandMap, parseCommandString} from "../../../SlashCommands";

const REGEX_EMOTICON_WHITESPACE = new RegExp('(?:^|\\s)(' + EMOTICON_REGEX.source + ')\\s$');

const IS_MAC = navigator.platform.indexOf("Mac") !== -1;

function ctrlShortcutLabel(key) {
    return (IS_MAC ? "⌘" : "Ctrl") + "+" + key;
}

function cloneSelection(selection) {
    return {
        anchorNode: selection.anchorNode,
        anchorOffset: selection.anchorOffset,
        focusNode: selection.focusNode,
        focusOffset: selection.focusOffset,
        isCollapsed: selection.isCollapsed,
        rangeCount: selection.rangeCount,
        type: selection.type,
    };
}

function selectionEquals(a: Selection, b: Selection): boolean {
    return a.anchorNode === b.anchorNode &&
        a.anchorOffset === b.anchorOffset &&
        a.focusNode === b.focusNode &&
        a.focusOffset === b.focusOffset &&
        a.isCollapsed === b.isCollapsed &&
        a.rangeCount === b.rangeCount &&
        a.type === b.type;
}

export default class BasicMessageEditor extends React.Component {
    static propTypes = {
        onChange: PropTypes.func,
        onPaste: PropTypes.func, // returns true if handled and should skip internal onPaste handler
        model: PropTypes.instanceOf(EditorModel).isRequired,
        room: PropTypes.instanceOf(Room).isRequired,
        placeholder: PropTypes.string,
        label: PropTypes.string,    // the aria label
        initialCaret: PropTypes.object, // See DocumentPosition in editor/model.js
    };

    constructor(props) {
        super(props);
        this.state = {
            autoComplete: null,
            showPillAvatar: SettingsStore.getValue("Pill.shouldShowPillAvatar"),
        };
        this._editorRef = null;
        this._autocompleteRef = null;
        this._formatBarRef = null;
        this._modifiedFlag = false;
        this._isIMEComposing = false;
        this._hasTextSelected = false;
        this._emoticonSettingHandle = null;
        this._shouldShowPillAvatarSettingHandle = null;
    }

    componentDidUpdate(prevProps) {
        if (this.props.placeholder !== prevProps.placeholder && this.props.placeholder) {
            const {isEmpty} = this.props.model;
            if (isEmpty) {
                this._showPlaceholder();
            } else {
                this._hidePlaceholder();
            }
        }
    }

    _replaceEmoticon = (caretPosition, inputType, diff) => {
        const {model} = this.props;
        const range = model.startRange(caretPosition);
        // expand range max 8 characters backwards from caretPosition,
        // as a space to look for an emoticon
        let n = 8;
        range.expandBackwardsWhile((index, offset) => {
            const part = model.parts[index];
            n -= 1;
            return n >= 0 && (part.type === "plain" || part.type === "pill-candidate");
        });
        const emoticonMatch = REGEX_EMOTICON_WHITESPACE.exec(range.text);
        if (emoticonMatch) {
            const query = emoticonMatch[1].replace("-", "");
            // try both exact match and lower-case, this means that xd won't match xD but :P will match :p
            const data = EMOTICON_TO_EMOJI.get(query) || EMOTICON_TO_EMOJI.get(query.toLowerCase());

            if (data) {
                const {partCreator} = model;
                const hasPrecedingSpace = emoticonMatch[0][0] === " ";
                // we need the range to only comprise of the emoticon
                // because we'll replace the whole range with an emoji,
                // so move the start forward to the start of the emoticon.
                // Take + 1 because index is reported without the possible preceding space.
                range.moveStart(emoticonMatch.index + (hasPrecedingSpace ? 1 : 0));
                // this returns the amount of added/removed characters during the replace
                // so the caret position can be adjusted.
                return range.replace([partCreator.plain(data.unicode + " ")]);
            }
        }
    }

    _updateEditorState = (selection, inputType, diff) => {
        renderModel(this._editorRef, this.props.model);
        if (selection) { // set the caret/selection
            try {
                setSelection(this._editorRef, this.props.model, selection);
            } catch (err) {
                console.error(err);
            }
            // if caret selection is a range, take the end position
            const position = selection.end || selection;
            this._setLastCaretFromPosition(position);
        }
        const {isEmpty} = this.props.model;
        if (this.props.placeholder) {
            if (isEmpty) {
                this._showPlaceholder();
            } else {
                this._hidePlaceholder();
            }
        }
        if (isEmpty) {
            this._formatBarRef.hide();
        }
        this.setState({autoComplete: this.props.model.autoComplete});
        this.historyManager.tryPush(this.props.model, selection, inputType, diff);

        let isTyping = !this.props.model.isEmpty;
        // If the user is entering a command, only consider them typing if it is one which sends a message into the room
        if (isTyping && this.props.model.parts[0].type === "command") {
            const {cmd} = parseCommandString(this.props.model.parts[0].text);
            if (!CommandMap.has(cmd) || CommandMap.get(cmd).category !== CommandCategories.messages) {
                isTyping = false;
            }
        }
        TypingStore.sharedInstance().setSelfTyping(this.props.room.roomId, isTyping);

        if (this.props.onChange) {
            this.props.onChange();
        }
    }

    _showPlaceholder() {
        this._editorRef.style.setProperty("--placeholder", `'${this.props.placeholder}'`);
        this._editorRef.classList.add("mx_BasicMessageComposer_inputEmpty");
    }

    _hidePlaceholder() {
        this._editorRef.classList.remove("mx_BasicMessageComposer_inputEmpty");
        this._editorRef.style.removeProperty("--placeholder");
    }

    _onCompositionStart = (event) => {
        this._isIMEComposing = true;
        // even if the model is empty, the composition text shouldn't be mixed with the placeholder
        this._hidePlaceholder();
    }

    _onCompositionEnd = (event) => {
        this._isIMEComposing = false;
        // some browsers (Chrome) don't fire an input event after ending a composition,
        // so trigger a model update after the composition is done by calling the input handler.

        // however, modifying the DOM (caused by the editor model update) from the compositionend handler seems
        // to confuse the IME in Chrome, likely causing https://github.com/vector-im/riot-web/issues/10913 ,
        // so we do it async

        // however, doing this async seems to break things in Safari for some reason, so browser sniff.

        const ua = navigator.userAgent.toLowerCase();
        const isSafari = ua.includes('safari/') && !ua.includes('chrome/');

        if (isSafari) {
            this._onInput({inputType: "insertCompositionText"});
        } else {
            Promise.resolve().then(() => {
                this._onInput({inputType: "insertCompositionText"});
            });
        }
    }

    isComposing(event) {
        // checking the event.isComposing flag just in case any browser out there
        // emits events related to the composition after compositionend
        // has been fired
        return !!(this._isIMEComposing || (event.nativeEvent && event.nativeEvent.isComposing));
    }

    _onCutCopy = (event, type) => {
        const selection = document.getSelection();
        const text = selection.toString();
        if (text) {
            const {model} = this.props;
            const range = getRangeForSelection(this._editorRef, model, selection);
            const selectedParts = range.parts.map(p => p.serialize());
            event.clipboardData.setData("application/x-riot-composer", JSON.stringify(selectedParts));
            event.clipboardData.setData("text/plain", text); // so plain copy/paste works
            if (type === "cut") {
                // Remove the text, updating the model as appropriate
                this._modifiedFlag = true;
                replaceRangeAndMoveCaret(range, []);
            }
            event.preventDefault();
        }
    }

    _onCopy = (event) => {
        this._onCutCopy(event, "copy");
    }

    _onCut = (event) => {
        this._onCutCopy(event, "cut");
    }

    _onPaste = (event) => {
        event.preventDefault(); // we always handle the paste ourselves
        if (this.props.onPaste && this.props.onPaste(event, this.props.model)) {
            // to prevent double handling, allow props.onPaste to skip internal onPaste
            return true;
        }

        const {model} = this.props;
        const {partCreator} = model;
        const partsText = event.clipboardData.getData("application/x-riot-composer");
        let parts;
        if (partsText) {
            const serializedTextParts = JSON.parse(partsText);
            const deserializedParts = serializedTextParts.map(p => partCreator.deserializePart(p));
            parts = deserializedParts;
        } else {
            const text = event.clipboardData.getData("text/plain");
            parts = parsePlainTextMessage(text, partCreator);
        }
        this._modifiedFlag = true;
        const range = getRangeForSelection(this._editorRef, model, document.getSelection());
        replaceRangeAndMoveCaret(range, parts);
    }

    _onInput = (event) => {
        // ignore any input while doing IME compositions
        if (this._isIMEComposing) {
            return;
        }
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
        this._modifiedFlag = true;
        this.props.model.update(newText, inputType, caret);
    }

    // this is used later to see if we need to recalculate the caret
    // on selectionchange. If it is just a consequence of typing
    // we don't need to. But if the user is navigating the caret without input
    // we need to recalculate it, to be able to know where to insert content after
    // losing focus
    _setLastCaretFromPosition(position) {
        const {model} = this.props;
        this._isCaretAtEnd = position.isAtEnd(model);
        this._lastCaret = position.asOffset(model);
        this._lastSelection = cloneSelection(document.getSelection());
    }

    _refreshLastCaretIfNeeded() {
        // XXX: needed when going up and down in editing messages ... not sure why yet
        // because the editors should stop doing this when when blurred ...
        // maybe it's on focus and the _editorRef isn't available yet or something.
        if (!this._editorRef) {
            return;
        }
        const selection = document.getSelection();
        if (!this._lastSelection || !selectionEquals(this._lastSelection, selection)) {
            this._lastSelection = cloneSelection(selection);
            const {caret, text} = getCaretOffsetAndText(this._editorRef, selection);
            this._lastCaret = caret;
            this._isCaretAtEnd = caret.offset === text.length;
        }
        return this._lastCaret;
    }

    clearUndoHistory() {
        this.historyManager.clear();
    }

    getCaret() {
        return this._lastCaret;
    }

    isSelectionCollapsed() {
        return !this._lastSelection || this._lastSelection.isCollapsed;
    }

    isCaretAtStart() {
        return this.getCaret().offset === 0;
    }

    isCaretAtEnd() {
        return this._isCaretAtEnd;
    }

    _onBlur = () => {
        document.removeEventListener("selectionchange", this._onSelectionChange);
    }

    _onFocus = () => {
        document.addEventListener("selectionchange", this._onSelectionChange);
        // force to recalculate
        this._lastSelection = null;
        this._refreshLastCaretIfNeeded();
    }

    _onSelectionChange = () => {
        const {isEmpty} = this.props.model;

        this._refreshLastCaretIfNeeded();
        const selection = document.getSelection();
        if (this._hasTextSelected && selection.isCollapsed) {
            this._hasTextSelected = false;
            if (this._formatBarRef) {
                this._formatBarRef.hide();
            }
        } else if (!selection.isCollapsed && !isEmpty) {
            this._hasTextSelected = true;
            if (this._formatBarRef) {
                const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
                this._formatBarRef.showAt(selectionRect);
            }
        }
    }

    _onKeyDown = (event) => {
        const model = this.props.model;
        const modKey = IS_MAC ? event.metaKey : event.ctrlKey;
        let handled = false;
        // format bold
        if (modKey && event.key === Key.B) {
            this._onFormatAction("bold");
            handled = true;
        // format italics
        } else if (modKey && event.key === Key.I) {
            this._onFormatAction("italics");
            handled = true;
        // format quote
        } else if (modKey && event.key === Key.GREATER_THAN) {
            this._onFormatAction("quote");
            handled = true;
        // redo
        } else if ((!IS_MAC && modKey && event.key === Key.Y) ||
                  (IS_MAC && modKey && event.shiftKey && event.key === Key.Z)) {
            if (this.historyManager.canRedo()) {
                const {parts, caret} = this.historyManager.redo();
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                model.reset(parts, caret, "historyRedo");
            }
            handled = true;
        // undo
        } else if (modKey && event.key === Key.Z) {
            if (this.historyManager.canUndo()) {
                const {parts, caret} = this.historyManager.undo(this.props.model);
                // pass matching inputType so historyManager doesn't push echo
                // when invoked from rerender callback.
                model.reset(parts, caret, "historyUndo");
            }
            handled = true;
        // insert newline on Shift+Enter
        } else if (event.key === Key.ENTER && (event.shiftKey || (IS_MAC && event.altKey))) {
            this._insertText("\n");
            handled = true;
        // move selection to start of composer
        } else if (modKey && event.key === Key.HOME && !event.shiftKey) {
            setSelection(this._editorRef, model, {
                index: 0,
                offset: 0,
            });
            handled = true;
        // move selection to end of composer
        } else if (modKey && event.key === Key.END && !event.shiftKey) {
            setSelection(this._editorRef, model, {
                index: model.parts.length - 1,
                offset: model.parts[model.parts.length - 1].text.length,
            });
            handled = true;
        // autocomplete or enter to send below shouldn't have any modifier keys pressed.
        } else {
            const metaOrAltPressed = event.metaKey || event.altKey;
            const modifierPressed = metaOrAltPressed || event.shiftKey;
            if (model.autoComplete && model.autoComplete.hasCompletions()) {
                const autoComplete = model.autoComplete;
                switch (event.key) {
                    case Key.ARROW_UP:
                        if (!modifierPressed) {
                            autoComplete.onUpArrow(event);
                            handled = true;
                        }
                        break;
                    case Key.ARROW_DOWN:
                        if (!modifierPressed) {
                            autoComplete.onDownArrow(event);
                            handled = true;
                        }
                        break;
                    case Key.TAB:
                        if (!metaOrAltPressed) {
                            autoComplete.onTab(event);
                            handled = true;
                        }
                        break;
                    case Key.ESCAPE:
                        if (!modifierPressed) {
                            autoComplete.onEscape(event);
                            handled = true;
                        }
                        break;
                    default:
                        return; // don't preventDefault on anything else
                }
            } else if (event.key === Key.TAB) {
                this._tabCompleteName();
                handled = true;
            } else if (event.key === Key.BACKSPACE || event.key === Key.DELETE) {
                this._formatBarRef.hide();
            }
        }
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    async _tabCompleteName() {
        try {
            await new Promise(resolve => this.setState({showVisualBell: false}, resolve));
            const {model} = this.props;
            const caret = this.getCaret();
            const position = model.positionForOffset(caret.offset, caret.atNodeEnd);
            const range = model.startRange(position);
            range.expandBackwardsWhile((index, offset, part) => {
                return part.text[offset] !== " " && (
                    part.type === "plain" ||
                    part.type === "pill-candidate" ||
                    part.type === "command"
                );
            });
            const {partCreator} = model;
            // await for auto-complete to be open
            await model.transform(() => {
                const addedLen = range.replace([partCreator.pillCandidate(range.text)]);
                return model.positionForOffset(caret.offset + addedLen, true);
            });

            // Don't try to do things with the autocomplete if there is none shown
            if (model.autoComplete) {
                await model.autoComplete.onTab();
                if (!model.autoComplete.hasSelection()) {
                    this.setState({showVisualBell: true});
                    model.autoComplete.close();
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    isModified() {
        return this._modifiedFlag;
    }

    _onAutoCompleteConfirm = (completion) => {
        this.props.model.autoComplete.onComponentConfirm(completion);
    }

    _onAutoCompleteSelectionChange = (completion, completionIndex) => {
        this.props.model.autoComplete.onComponentSelectionChange(completion);
        this.setState({completionIndex});
    }

    _configureEmoticonAutoReplace = () => {
        const shouldReplace = SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji');
        this.props.model.setTransformCallback(shouldReplace ? this._replaceEmoticon : null);
    };

    _configureShouldShowPillAvatar = () => {
        const showPillAvatar = SettingsStore.getValue("Pill.shouldShowPillAvatar");
        this.setState({ showPillAvatar });
    };

    componentWillUnmount() {
        document.removeEventListener("selectionchange", this._onSelectionChange);
        this._editorRef.removeEventListener("input", this._onInput, true);
        this._editorRef.removeEventListener("compositionstart", this._onCompositionStart, true);
        this._editorRef.removeEventListener("compositionend", this._onCompositionEnd, true);
        SettingsStore.unwatchSetting(this._emoticonSettingHandle);
        SettingsStore.unwatchSetting(this._shouldShowPillAvatarSettingHandle);
    }

    componentDidMount() {
        const model = this.props.model;
        model.setUpdateCallback(this._updateEditorState);
        this._emoticonSettingHandle = SettingsStore.watchSetting('MessageComposerInput.autoReplaceEmoji', null,
            this._configureEmoticonAutoReplace);
        this._configureEmoticonAutoReplace();
        this._shouldShowPillAvatarSettingHandle = SettingsStore.watchSetting("Pill.shouldShowPillAvatar", null,
            this._configureShouldShowPillAvatar);
        const partCreator = model.partCreator;
        // TODO: does this allow us to get rid of EditorStateTransfer?
        // not really, but we could not serialize the parts, and just change the autoCompleter
        partCreator.setAutoCompleteCreator(autoCompleteCreator(
            () => this._autocompleteRef,
            query => new Promise(resolve => this.setState({query}, resolve)),
        ));
        this.historyManager = new HistoryManager(partCreator);
        // initial render of model
        this._updateEditorState(this._getInitialCaretPosition());
        // attach input listener by hand so React doesn't proxy the events,
        // as the proxied event doesn't support inputType, which we need.
        this._editorRef.addEventListener("input", this._onInput, true);
        this._editorRef.addEventListener("compositionstart", this._onCompositionStart, true);
        this._editorRef.addEventListener("compositionend", this._onCompositionEnd, true);
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

    _onFormatAction = (action) => {
        const range = getRangeForSelection(
            this._editorRef,
            this.props.model,
            document.getSelection());
        if (range.length === 0) {
            return;
        }
        this.historyManager.ensureLastChangesPushed(this.props.model);
        this._modifiedFlag = true;
        switch (action) {
            case "bold":
                toggleInlineFormat(range, "**");
                break;
            case "italics":
                toggleInlineFormat(range, "_");
                break;
            case "strikethrough":
                toggleInlineFormat(range, "<del>", "</del>");
                break;
            case "code":
                formatRangeAsCode(range);
                break;
            case "quote":
                formatRangeAsQuote(range);
                break;
        }
    }

    render() {
        let autoComplete;
        if (this.state.autoComplete) {
            const query = this.state.query;
            const queryLen = query.length;
            autoComplete = (<div className="mx_BasicMessageComposer_AutoCompleteWrapper">
                <Autocomplete
                    ref={ref => this._autocompleteRef = ref}
                    query={query}
                    onConfirm={this._onAutoCompleteConfirm}
                    onSelectionChange={this._onAutoCompleteSelectionChange}
                    selection={{beginning: true, end: queryLen, start: queryLen}}
                    room={this.props.room}
                />
            </div>);
        }
        const wrapperClasses = classNames("mx_BasicMessageComposer", {
            "mx_BasicMessageComposer_input_error": this.state.showVisualBell,
        });
        const classes = classNames("mx_BasicMessageComposer_input", {
            "mx_BasicMessageComposer_input_shouldShowPillAvatar": this.state.showPillAvatar,
        });

        const MessageComposerFormatBar = sdk.getComponent('rooms.MessageComposerFormatBar');
        const shortcuts = {
            bold: ctrlShortcutLabel("B"),
            italics: ctrlShortcutLabel("I"),
            quote: ctrlShortcutLabel(">"),
        };

        const {completionIndex} = this.state;

        return (<div className={wrapperClasses}>
            { autoComplete }
            <MessageComposerFormatBar ref={ref => this._formatBarRef = ref} onAction={this._onFormatAction} shortcuts={shortcuts} />
            <div
                className={classes}
                contentEditable="true"
                tabIndex="0"
                onBlur={this._onBlur}
                onFocus={this._onFocus}
                onCopy={this._onCopy}
                onCut={this._onCut}
                onPaste={this._onPaste}
                onKeyDown={this._onKeyDown}
                ref={ref => this._editorRef = ref}
                aria-label={this.props.label}
                role="textbox"
                aria-multiline="true"
                aria-autocomplete="both"
                aria-haspopup="listbox"
                aria-expanded={Boolean(this.state.autoComplete)}
                aria-activedescendant={completionIndex >= 0 ? generateCompletionDomId(completionIndex) : undefined}
                dir="auto"
            />
        </div>);
    }

    focus() {
        this._editorRef.focus();
    }
}
