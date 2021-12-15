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
import { MsgType } from 'matrix-js-sdk/src/@types/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import EditorModel from '../../../editor/model';
import { getCaretOffsetAndText } from '../../../editor/dom';
import { htmlSerializeIfNeeded, textSerialize, containsEmote, stripEmoteCommand } from '../../../editor/serialize';
import { findEditableEvent } from '../../../utils/EventUtils';
import { parseEvent } from '../../../editor/deserialize';
import { CommandPartCreator, Part, PartCreator, Type } from '../../../editor/parts';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import BasicMessageComposer, { REGEX_EMOTICON } from "./BasicMessageComposer";
import { Command, CommandCategories, getCommand } from '../../../SlashCommands';
import { Action } from "../../../dispatcher/actions";
import CountlyAnalytics from "../../../CountlyAnalytics";
import { getKeyBindingsManager, MessageComposerAction } from '../../../KeyBindingsManager';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import SendHistoryManager from '../../../SendHistoryManager';
import Modal from '../../../Modal';
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import { ActionPayload } from "../../../dispatcher/payloads";
import AccessibleButton from '../elements/AccessibleButton';
import { createRedactEventDialog } from '../dialogs/ConfirmRedactDialog';
import SettingsStore from "../../../settings/SettingsStore";
import { withMatrixClientHOC, MatrixClientProps } from '../../../contexts/MatrixClientContext';
import RoomContext from '../../../contexts/RoomContext';
import { ComposerType } from "../../../dispatcher/payloads/ComposerInsertPayload";

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

function createEditContent(
    model: EditorModel,
    editedEvent: MatrixEvent,
): IContent {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    const isReply = !!editedEvent.replyEventId;
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

    const relation = {
        "m.new_content": newContent,
        "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": editedEvent.getId(),
        },
    };

    return Object.assign(relation, contentBody);
}

interface IEditMessageComposerProps extends MatrixClientProps {
    editState: EditorStateTransfer;
    className?: string;
}
interface IState {
    saveDisabled: boolean;
}

@replaceableComponent("views.rooms.EditMessageComposer")
class EditMessageComposer extends React.Component<IEditMessageComposerProps, IState> {
    static contextType = RoomContext;
    context!: React.ContextType<typeof RoomContext>;

    private readonly editorRef = createRef<BasicMessageComposer>();
    private readonly dispatcherRef: string;
    private model: EditorModel = null;

    constructor(props: IEditMessageComposerProps, context: React.ContextType<typeof RoomContext>) {
        super(props);
        this.context = context; // otherwise React will only set it prior to render due to type def above

        const isRestored = this.createEditorModel();
        const ev = this.props.editState.getEvent();

        const editContent = createEditContent(this.model, ev);
        this.state = {
            saveDisabled: !isRestored || !this.isContentModified(editContent["m.new_content"]),
        };

        window.addEventListener("beforeunload", this.saveStoredEditorState);
        this.dispatcherRef = dis.register(this.onAction);
    }

    private getRoom(): Room {
        return this.props.mxClient.getRoom(this.props.editState.getEvent().getRoomId());
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
                event.stopPropagation();
                event.preventDefault();
                break;
            case MessageComposerAction.CancelEditing:
                event.stopPropagation();
                this.cancelEdit();
                break;
            case MessageComposerAction.EditPrevMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtStart()) {
                    return;
                }
                const previousEvent = findEditableEvent({
                    events: this.events,
                    isForward: false,
                    fromEventId: this.props.editState.getEvent().getId(),
                });
                if (previousEvent) {
                    dis.dispatch({
                        action: Action.EditEvent,
                        event: previousEvent,
                        timelineRenderingType: this.context.timelineRenderingType,
                    });
                    event.preventDefault();
                }
                break;
            }
            case MessageComposerAction.EditNextMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtEnd()) {
                    return;
                }
                const nextEvent = findEditableEvent({
                    events: this.events,
                    isForward: true,
                    fromEventId: this.props.editState.getEvent().getId(),
                });
                if (nextEvent) {
                    dis.dispatch({
                        action: Action.EditEvent,
                        event: nextEvent,
                        timelineRenderingType: this.context.timelineRenderingType,
                    });
                } else {
                    this.clearStoredEditorState();
                    dis.dispatch({
                        action: Action.EditEvent,
                        event: null,
                        timelineRenderingType: this.context.timelineRenderingType,
                    });
                    dis.dispatch({
                        action: Action.FocusSendMessageComposer,
                        context: this.context.timelineRenderingType,
                    });
                }
                event.preventDefault();
                break;
            }
        }
    };

    private get editorRoomKey(): string {
        return `mx_edit_room_${this.getRoom().roomId}_${this.context.timelineRenderingType}`;
    }

    private get editorStateKey(): string {
        return `mx_edit_state_${this.props.editState.getEvent().getId()}`;
    }

    private get events(): MatrixEvent[] {
        const liveTimelineEvents = this.context.liveTimeline.getEvents();
        const pendingEvents = this.getRoom().getPendingEvents();
        const isInThread = Boolean(this.props.editState.getEvent().getThread());
        return liveTimelineEvents.concat(isInThread ? [] : pendingEvents);
    }

    private cancelEdit = (): void => {
        this.clearStoredEditorState();
        dis.dispatch({
            action: Action.EditEvent,
            event: null,
            timelineRenderingType: this.context.timelineRenderingType,
        });
        dis.dispatch({
            action: Action.FocusSendMessageComposer,
            context: this.context.timelineRenderingType,
        });
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
                logger.error("Error parsing editing state: ", e);
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

    private saveStoredEditorState = (): void => {
        const item = SendHistoryManager.createItem(this.model);
        this.clearPreviousEdit();
        localStorage.setItem(this.editorRoomKey, this.props.editState.getEvent().getId());
        localStorage.setItem(this.editorStateKey, JSON.stringify(item));
    };

    private isSlashCommand(): boolean {
        const parts = this.model.parts;
        const firstPart = parts[0];
        if (firstPart) {
            if (firstPart.type === Type.Command && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
                return true;
            }

            if (firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")
                && (firstPart.type === Type.Plain || firstPart.type === Type.PillCandidate)) {
                return true;
            }
        }
        return false;
    }

    private isContentModified(newContent: IContent): boolean {
        // if nothing has changed then bail
        const oldContent = this.props.editState.getEvent().getContent();
        if (oldContent["msgtype"] === newContent["msgtype"] && oldContent["body"] === newContent["body"] &&
            oldContent["format"] === newContent["format"] &&
            oldContent["formatted_body"] === newContent["formatted_body"]) {
            return false;
        }
        return true;
    }

    private getSlashCommand(): [Command, string, string] {
        const commandText = this.model.parts.reduce((text, part) => {
            // use mxid to textify user pills in a command
            if (part.type === Type.UserPill) {
                return text + part.resourceId;
            }
            return text + part.text;
        }, "");
        const { cmd, args } = getCommand(commandText);
        return [cmd, args, commandText];
    }

    private async runSlashCommand(cmd: Command, args: string, roomId: string): Promise<void> {
        const threadId = this.props.editState?.getEvent()?.getThread()?.id || null;

        const result = cmd.run(roomId, threadId, args);
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
            logger.error("Command failure: %s", error);
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
            logger.log("Command success.");
            if (messageContent) return messageContent;
        }
    }

    private sendEdit = async (): Promise<void> => {
        const startTime = CountlyAnalytics.getTimestamp();
        const editedEvent = this.props.editState.getEvent();

        // Replace emoticon at the end of the message
        if (SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji')) {
            const caret = this.editorRef.current?.getCaret();
            const position = this.model.positionForOffset(caret.offset, caret.atNodeEnd);
            this.editorRef.current?.replaceEmoticon(position, REGEX_EMOTICON);
        }
        const editContent = createEditContent(this.model, editedEvent);
        const newContent = editContent["m.new_content"];

        let shouldSend = true;

        if (newContent?.body === '') {
            this.cancelPreviousPendingEdit();
            createRedactEventDialog({
                mxEvent: editedEvent,
            });
            return;
        }

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

                const event = this.props.editState.getEvent();
                const threadId = event.threadRootId || null;

                const prom = this.props.mxClient.sendMessage(roomId, threadId, editContent);
                this.clearStoredEditorState();
                dis.dispatch({ action: "message_sent" });
                CountlyAnalytics.instance.trackSendMessage(startTime, prom, roomId, true, false, editContent);
            }
        }

        // close the event editing and focus composer
        dis.dispatch({
            action: Action.EditEvent,
            event: null,
            timelineRenderingType: this.context.timelineRenderingType,
        });
        dis.dispatch({
            action: Action.FocusSendMessageComposer,
            context: this.context.timelineRenderingType,
        });
    };

    private cancelPreviousPendingEdit(): void {
        const originalEvent = this.props.editState.getEvent();
        const previousEdit = originalEvent.replacingEvent();
        if (previousEdit && (
            previousEdit.status === EventStatus.QUEUED ||
            previousEdit.status === EventStatus.NOT_SENT
        )) {
            this.props.mxClient.cancelPendingEvent(previousEdit);
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

    private createEditorModel(): boolean {
        const { editState } = this.props;
        const room = this.getRoom();
        const partCreator = new CommandPartCreator(room, this.props.mxClient);

        let parts;
        let isRestored = false;
        if (editState.hasEditorState()) {
            // if restoring state from a previous editor,
            // restore serialized parts from the state
            parts = editState.getSerializedParts().map(p => partCreator.deserializePart(p));
        } else {
            // otherwise, either restore serialized parts from localStorage or parse the body of the event
            const restoredParts = this.restoreStoredEditorState(partCreator);
            parts = restoredParts || parseEvent(editState.getEvent(), partCreator);
            isRestored = !!restoredParts;
        }
        this.model = new EditorModel(parts, partCreator);
        this.saveStoredEditorState();

        return isRestored;
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
        if (!this.editorRef.current) return;

        if (payload.action === Action.ComposerInsert) {
            if (payload.timelineRenderingType !== this.context.timelineRenderingType) return;
            if (payload.composerType !== ComposerType.Edit) return;

            if (payload.userId) {
                this.editorRef.current?.insertMention(payload.userId);
            } else if (payload.event) {
                this.editorRef.current?.insertQuotedMessage(payload.event);
            } else if (payload.text) {
                this.editorRef.current?.insertPlaintext(payload.text);
            }
        } else if (payload.action === Action.FocusEditMessageComposer) {
            this.editorRef.current.focus();
        }
    };

    render() {
        return (<div className={classNames("mx_EditMessageComposer", this.props.className)} onKeyDown={this.onKeyDown}>
            <BasicMessageComposer
                ref={this.editorRef}
                model={this.model}
                room={this.getRoom()}
                threadId={this.props.editState?.getEvent()?.getThread()?.id}
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

const EditMessageComposerWithMatrixClient = withMatrixClientHOC(EditMessageComposer);
export default EditMessageComposerWithMatrixClient;
