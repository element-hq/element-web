/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef, KeyboardEvent } from 'react';
import classNames from 'classnames';
import { EventStatus, IContent, MatrixEvent } from 'matrix-js-sdk/src/models/event';

import { _t, _td } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import EditorModel from '../../../editor/model';
import { getCaretOffsetAndText } from '../../../editor/dom';
import { htmlSerializeIfNeeded, textSerialize, containsEmote, stripEmoteCommand } from '../../../editor/serialize';
import { findEditableEvent } from '../../../utils/EventUtils';
import { parseEvent } from '../../../editor/deserialize';
import { CommandPartCreator, Part, PartCreator } from '../../../editor/parts';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import BasicMessageComposer from "./BasicMessageComposer";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { Command, CommandCategories, getCommand } from '../../../SlashCommands';
import { Action } from "../../../dispatcher/actions";
import CountlyAnalytics from "../../../CountlyAnalytics";
import { getKeyBindingsManager, MessageComposerAction } from '../../../KeyBindingsManager';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import SendHistoryManager from '../../../SendHistoryManager';
import Modal from '../../../Modal';
import { MsgType } from 'matrix-js-sdk/src/@types/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import { ActionPayload } from "../../../dispatcher/payloads";
import AccessibleButton from '../elements/AccessibleButton';

function eventIsReply(mxEvent: MatrixEvent): boolean {
    const relatesTo = mxEvent.getContent()["m.relates_to"];
    return !!(relatesTo && relatesTo["m.in_reply_to"]);
}

function getHtmlReplyFallback(mxEvent: MatrixEvent): string {
    const html = mxEvent.getContent().formatted_body;
    if (!html) {
        return "";
    }
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    const mxReply = rootNode.querySelector("mx-reply");
    return (mxReply && mxReply.outerHTML) || "";
}

function getTextReplyFallback(mxEvent: MatrixEvent): string {
    const body = mxEvent.getContent().body;
    const lines = body.split("\n").map(l => l.trim());
    if (lines.length > 2 && lines[0].startsWith("> ") && lines[1].length === 0) {
        return `${lines[0]}\n\n`;
    }
    return "";
}

function createEditContent(model: EditorModel, editedEvent: MatrixEvent): IContent {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    const isReply = eventIsReply(editedEvent);
    let plainPrefix = "";
    let htmlPrefix = "";

    if (isReply) {
        plainPrefix = getTextReplyFallback(editedEvent);
        htmlPrefix = getHtmlReplyFallback(editedEvent);
    }

    const body = textSerialize(model);

    const newContent: IContent = {
        "msgtype": isEmote ? MsgType.Emote : MsgType.Text,
        "body": body,
    };
    const contentBody: IContent = {
        msgtype: newContent.msgtype,
        body: `${plainPrefix} * ${body}`,
    };

    const formattedBody = htmlSerializeIfNeeded(model, { forceHTML: isReply });
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

interface IProps {
    editState: EditorStateTransfer;
    className?: string;
}

interface IState {
    saveDisabled: boolean;
}

@replaceableComponent("views.rooms.EditMessageComposer")
export default class EditMessageComposer extends React.Component<IProps, IState> {
    static contextType = MatrixClientContext;
    context!: React.ContextType<typeof MatrixClientContext>;

    private readonly editorRef = createRef<BasicMessageComposer>();
    private readonly dispatcherRef: string;
    private model: EditorModel = null;

    constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props);
        this.context = context; // otherwise React will only set it prior to render due to type def above

        this.state = {
            saveDisabled: true,
        };

        this.createEditorModel();
        window.addEventListener("beforeunload", this.saveStoredEditorState);
        this.dispatcherRef = dis.register(this.onAction);
    }

    private getRoom(): Room {
        return this.context.getRoom(this.props.editState.getEvent().getRoomId());
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        // ignore any keypress while doing IME compositions
        if (this.editorRef.current?.isComposing(event)) {
            return;
        }
        const action = getKeyBindingsManager().getMessageComposerAction(event);
        switch (action) {
            case MessageComposerAction.Send:
                this.sendEdit();
                event.preventDefault();
                break;
            case MessageComposerAction.CancelEditing:
                this.cancelEdit();
                break;
            case MessageComposerAction.EditPrevMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtStart()) {
                    return;
                }
                const previousEvent = findEditableEvent(this.getRoom(), false,
                    this.props.editState.getEvent().getId());
                if (previousEvent) {
                    dis.dispatch({ action: 'edit_event', event: previousEvent });
                    event.preventDefault();
                }
                break;
            }
            case MessageComposerAction.EditNextMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtEnd()) {
                    return;
                }
                const nextEvent = findEditableEvent(this.getRoom(), true, this.props.editState.getEvent().getId());
                if (nextEvent) {
                    dis.dispatch({ action: 'edit_event', event: nextEvent });
                } else {
                    this.clearStoredEditorState();
                    dis.dispatch({ action: 'edit_event', event: null });
                    dis.fire(Action.FocusComposer);
                }
                event.preventDefault();
                break;
            }
        }
    };

    private get editorRoomKey(): string {
        return `mx_edit_room_${this.getRoom().roomId}`;
    }

    private get editorStateKey(): string {
        return `mx_edit_state_${this.props.editState.getEvent().getId()}`;
    }

    private cancelEdit = (): void => {
        this.clearStoredEditorState();
        dis.dispatch({ action: "edit_event", event: null });
        dis.fire(Action.FocusComposer);
    };

    private get shouldSaveStoredEditorState(): boolean {
        return localStorage.getItem(this.editorRoomKey) !== null;
    }

    private restoreStoredEditorState(partCreator: PartCreator): Part[] {
        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const { parts: serializedParts } = JSON.parse(json);
                const parts: Part[] = serializedParts.map(p => partCreator.deserializePart(p));
                return parts;
            } catch (e) {
                console.error("Error parsing editing state: ", e);
            }
        }
    }

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorRoomKey);
        localStorage.removeItem(this.editorStateKey);
    }

    private clearPreviousEdit(): void {
        if (localStorage.getItem(this.editorRoomKey)) {
            localStorage.removeItem(`mx_edit_state_${localStorage.getItem(this.editorRoomKey)}`);
        }
    }

    private saveStoredEditorState(): void {
        const item = SendHistoryManager.createItem(this.model);
        this.clearPreviousEdit();
        localStorage.setItem(this.editorRoomKey, this.props.editState.getEvent().getId());
        localStorage.setItem(this.editorStateKey, JSON.stringify(item));
    }

    private isSlashCommand(): boolean {
        const parts = this.model.parts;
        const firstPart = parts[0];
        if (firstPart) {
            if (firstPart.type === "command" && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
                return true;
            }

            if (firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")
                && (firstPart.type === "plain" || firstPart.type === "pill-candidate")) {
                return true;
            }
        }
        return false;
    }

    private isContentModified(newContent: IContent): boolean {
        // if nothing has changed then bail
        const oldContent = this.props.editState.getEvent().getContent();
        if (!this.editorRef.current?.isModified() ||
            (oldContent["msgtype"] === newContent["msgtype"] && oldContent["body"] === newContent["body"] &&
            oldContent["format"] === newContent["format"] &&
            oldContent["formatted_body"] === newContent["formatted_body"])) {
            return false;
        }
        return true;
    }

    private getSlashCommand(): [Command, string, string] {
        const commandText = this.model.parts.reduce((text, part) => {
            // use mxid to textify user pills in a command
            if (part.type === "user-pill") {
                return text + part.resourceId;
            }
            return text + part.text;
        }, "");
        const { cmd, args } = getCommand(commandText);
        return [cmd, args, commandText];
    }

    private async runSlashCommand(cmd: Command, args: string, roomId: string): Promise<void> {
        const result = cmd.run(roomId, args);
        let messageContent;
        let error = result.error;
        if (result.promise) {
            try {
                if (cmd.category === CommandCategories.messages) {
                    messageContent = await result.promise;
                } else {
                    await result.promise;
                }
            } catch (err) {
                error = err;
            }
        }
        if (error) {
            console.error("Command failure: %s", error);
            // assume the error is a server error when the command is async
            const isServerError = !!result.promise;
            const title = isServerError ? _td("Server error") : _td("Command error");

            let errText;
            if (typeof error === 'string') {
                errText = error;
            } else if (error.message) {
                errText = error.message;
            } else {
                errText = _t("Server unavailable, overloaded, or something else went wrong.");
            }

            Modal.createTrackedDialog(title, '', ErrorDialog, {
                title: _t(title),
                description: errText,
            });
        } else {
            console.log("Command success.");
            if (messageContent) return messageContent;
        }
    }

    private sendEdit = async (): Promise<void> => {
        const startTime = CountlyAnalytics.getTimestamp();
        const editedEvent = this.props.editState.getEvent();
        const editContent = createEditContent(this.model, editedEvent);
        const newContent = editContent["m.new_content"];

        let shouldSend = true;

        // If content is modified then send an updated event into the room
        if (this.isContentModified(newContent)) {
            const roomId = editedEvent.getRoomId();
            if (!containsEmote(this.model) && this.isSlashCommand()) {
                const [cmd, args, commandText] = this.getSlashCommand();
                if (cmd) {
                    if (cmd.category === CommandCategories.messages) {
                        editContent["m.new_content"] = await this.runSlashCommand(cmd, args, roomId);
                    } else {
                        this.runSlashCommand(cmd, args, roomId);
                        shouldSend = false;
                    }
                } else {
                    // ask the user if their unknown command should be sent as a message
                    const { finished } = Modal.createTrackedDialog("Unknown command", "", QuestionDialog, {
                        title: _t("Unknown Command"),
                        description: <div>
                            <p>
                                { _t("Unrecognised command: %(commandText)s", { commandText }) }
                            </p>
                            <p>
                                { _t("You can use <code>/help</code> to list available commands. " +
                                    "Did you mean to send this as a message?", {}, {
                                    code: t => <code>{ t }</code>,
                                }) }
                            </p>
                            <p>
                                { _t("Hint: Begin your message with <code>//</code> to start it with a slash.", {}, {
                                    code: t => <code>{ t }</code>,
                                }) }
                            </p>
                        </div>,
                        button: _t('Send as message'),
                    });
                    const [sendAnyway] = await finished;
                    // if !sendAnyway bail to let the user edit the composer and try again
                    if (!sendAnyway) return;
                }
            }
            if (shouldSend) {
                this.cancelPreviousPendingEdit();
                const prom = this.context.sendMessage(roomId, editContent);
                this.clearStoredEditorState();
                dis.dispatch({ action: "message_sent" });
                CountlyAnalytics.instance.trackSendMessage(startTime, prom, roomId, true, false, editContent);
            }
        }

        // close the event editing and focus composer
        dis.dispatch({ action: "edit_event", event: null });
        dis.fire(Action.FocusComposer);
    };

    private cancelPreviousPendingEdit(): void {
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
            caret = getCaretOffsetAndText(this.editorRef.current?.editorRef.current, sel).caret;
        }
        const parts = this.model.serializeParts();
        // if caret is undefined because for some reason there isn't a valid selection,
        // then when mounting the editor again with the same editor state,
        // it will set the cursor at the end.
        this.props.editState.setEditorState(caret, parts);
        window.removeEventListener("beforeunload", this.saveStoredEditorState);
        if (this.shouldSaveStoredEditorState) {
            this.saveStoredEditorState();
        }
        dis.unregister(this.dispatcherRef);
    }

    private createEditorModel(): void {
        const { editState } = this.props;
        const room = this.getRoom();
        const partCreator = new CommandPartCreator(room, this.context);
        let parts;
        if (editState.hasEditorState()) {
            // if restoring state from a previous editor,
            // restore serialized parts from the state
            parts = editState.getSerializedParts().map(p => partCreator.deserializePart(p));
        } else {
            //otherwise, either restore serialized parts from localStorage or parse the body of the event
            parts = this.restoreStoredEditorState(partCreator) || parseEvent(editState.getEvent(), partCreator);
        }
        this.model = new EditorModel(parts, partCreator);
        this.saveStoredEditorState();
    }

    private getInitialCaretPosition(): CaretPosition {
        const { editState } = this.props;
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

    private onChange = (): void => {
        if (!this.state.saveDisabled || !this.editorRef.current?.isModified()) {
            return;
        }

        this.setState({
            saveDisabled: false,
        });
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "edit_composer_insert" && this.editorRef.current) {
            if (payload.userId) {
                this.editorRef.current?.insertMention(payload.userId);
            } else if (payload.event) {
                this.editorRef.current?.insertQuotedMessage(payload.event);
            } else if (payload.text) {
                this.editorRef.current?.insertPlaintext(payload.text);
            }
        }
    };

    render() {
        return (<div className={classNames("mx_EditMessageComposer", this.props.className)} onKeyDown={this.onKeyDown}>
            <BasicMessageComposer
                ref={this.editorRef}
                model={this.model}
                room={this.getRoom()}
                initialCaret={this.props.editState.getCaret()}
                label={_t("Edit message")}
                onChange={this.onChange}
            />
            <div className="mx_EditMessageComposer_buttons">
                <AccessibleButton kind="secondary" onClick={this.cancelEdit}>
                    { _t("Cancel") }
                </AccessibleButton>
                <AccessibleButton kind="primary" onClick={this.sendEdit} disabled={this.state.saveDisabled}>
                    { _t("Save") }
                </AccessibleButton>
            </div>
        </div>);
    }
}
