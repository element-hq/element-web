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

import React, { ClipboardEvent, createRef, KeyboardEvent } from 'react';
import EMOJI_REGEX from 'emojibase-regex';
import { IContent, MatrixEvent, IEventRelation } from 'matrix-js-sdk/src/models/event';
import { DebouncedFunc, throttle } from 'lodash';
import { EventType, RelationType } from "matrix-js-sdk/src/@types/event";
import { logger } from "matrix-js-sdk/src/logger";
import { Room } from 'matrix-js-sdk/src/models/room';

import dis from '../../../dispatcher/dispatcher';
import EditorModel from '../../../editor/model';
import {
    containsEmote,
    htmlSerializeIfNeeded,
    startsWith,
    stripEmoteCommand,
    stripPrefix,
    textSerialize,
    unescapeMessage,
} from '../../../editor/serialize';
import BasicMessageComposer, { REGEX_EMOTICON } from "./BasicMessageComposer";
import { CommandPartCreator, Part, PartCreator, SerializedPart, Type } from '../../../editor/parts';
import ReplyChain from "../elements/ReplyChain";
import { findEditableEvent } from '../../../utils/EventUtils';
import SendHistoryManager from "../../../SendHistoryManager";
import { Command, CommandCategories, getCommand } from '../../../SlashCommands';
import Modal from '../../../Modal';
import { _t, _td } from '../../../languageHandler';
import ContentMessages from '../../../ContentMessages';
import { withMatrixClientHOC, MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { Action } from "../../../dispatcher/actions";
import { containsEmoji } from "../../../effects/utils";
import { CHAT_EFFECTS } from '../../../effects';
import CountlyAnalytics from "../../../CountlyAnalytics";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { getKeyBindingsManager, MessageComposerAction } from '../../../KeyBindingsManager';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import SettingsStore from '../../../settings/SettingsStore';
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import { ActionPayload } from "../../../dispatcher/payloads";
import { decorateStartSendingTime, sendRoundTripMetric } from "../../../sendTimePerformanceMetrics";
import RoomContext, { TimelineRenderingType } from '../../../contexts/RoomContext';
import DocumentPosition from "../../../editor/position";
import { ComposerType } from "../../../dispatcher/payloads/ComposerInsertPayload";

function addReplyToMessageContent(
    content: IContent,
    replyToEvent: MatrixEvent,
    permalinkCreator: RoomPermalinkCreator,
): void {
    const replyContent = ReplyChain.makeReplyMixIn(replyToEvent);
    Object.assign(content, replyContent);

    // Part of Replies fallback support - prepend the text we're sending
    // with the text we're replying to
    const nestedReply = ReplyChain.getNestedReplyText(replyToEvent, permalinkCreator);
    if (nestedReply) {
        if (content.formatted_body) {
            content.formatted_body = nestedReply.html + content.formatted_body;
        }
        content.body = nestedReply.body + content.body;
    }
}

export function attachRelation(
    content: IContent,
    relation?: IEventRelation,
): void {
    if (relation) {
        content['m.relates_to'] = {
            ...relation, // the composer can have a default
            ...content['m.relates_to'],
        };
    }
}

// exported for tests
export function createMessageContent(
    model: EditorModel,
    replyToEvent: MatrixEvent,
    relation: IEventRelation,
    permalinkCreator: RoomPermalinkCreator,
): IContent {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    if (startsWith(model, "//")) {
        model = stripPrefix(model, "/");
    }
    model = unescapeMessage(model);

    const body = textSerialize(model);
    const content: IContent = {
        msgtype: isEmote ? "m.emote" : "m.text",
        body: body,
    };
    const formattedBody = htmlSerializeIfNeeded(model, { forceHTML: !!replyToEvent });
    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
    }

    if (replyToEvent) {
        addReplyToMessageContent(content, replyToEvent, permalinkCreator);
    }

    if (relation) {
        content['m.relates_to'] = {
            ...relation,
            ...content['m.relates_to'],
        };
    }

    return content;
}

// exported for tests
export function isQuickReaction(model: EditorModel): boolean {
    const parts = model.parts;
    if (parts.length == 0) return false;
    const text = textSerialize(model);
    // shortcut takes the form "+:emoji:" or "+ :emoji:""
    // can be in 1 or 2 parts
    if (parts.length <= 2) {
        const hasShortcut = text.startsWith("+") || text.startsWith("+ ");
        const emojiMatch = text.match(EMOJI_REGEX);
        if (hasShortcut && emojiMatch && emojiMatch.length == 1) {
            return emojiMatch[0] === text.substring(1) ||
                emojiMatch[0] === text.substring(2);
        }
    }
    return false;
}

interface ISendMessageComposerProps extends MatrixClientProps {
    room: Room;
    placeholder?: string;
    permalinkCreator: RoomPermalinkCreator;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    disabled?: boolean;
    onChange?(model: EditorModel): void;
}

@replaceableComponent("views.rooms.SendMessageComposer")
export class SendMessageComposer extends React.Component<ISendMessageComposerProps> {
    static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    private readonly prepareToEncrypt?: DebouncedFunc<() => void>;
    private readonly editorRef = createRef<BasicMessageComposer>();
    private model: EditorModel = null;
    private currentlyComposedEditorState: SerializedPart[] = null;
    private dispatcherRef: string;
    private sendHistoryManager: SendHistoryManager;

    constructor(props: ISendMessageComposerProps, context: React.ContextType<typeof RoomContext>) {
        super(props);
        if (this.props.mxClient.isCryptoEnabled() && this.props.mxClient.isRoomEncrypted(this.props.room.roomId)) {
            this.prepareToEncrypt = throttle(() => {
                this.props.mxClient.prepareToEncrypt(this.props.room);
            }, 60000, { leading: true, trailing: false });
        }

        window.addEventListener("beforeunload", this.saveStoredEditorState);
    }

    public componentDidUpdate(prevProps: ISendMessageComposerProps): void {
        const replyingToThread = this.props.relation?.key === RelationType.Thread;
        const differentEventTarget = this.props.relation?.event_id !== prevProps.relation?.event_id;

        const threadChanged = replyingToThread && (differentEventTarget);
        if (threadChanged) {
            const partCreator = new CommandPartCreator(this.props.room, this.props.mxClient);
            const parts = this.restoreStoredEditorState(partCreator) || [];
            this.model.reset(parts);
            this.editorRef.current?.focus();
        }
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        // ignore any keypress while doing IME compositions
        if (this.editorRef.current?.isComposing(event)) {
            return;
        }
        const replyingToThread = this.props.relation?.key === RelationType.Thread;
        const action = getKeyBindingsManager().getMessageComposerAction(event);
        switch (action) {
            case MessageComposerAction.Send:
                this.sendMessage();
                event.preventDefault();
                break;
            case MessageComposerAction.SelectPrevSendHistory:
            case MessageComposerAction.SelectNextSendHistory: {
                // Try select composer history
                const selected = this.selectSendHistory(action === MessageComposerAction.SelectPrevSendHistory);
                if (selected) {
                    // We're selecting history, so prevent the key event from doing anything else
                    event.preventDefault();
                }
                break;
            }
            case MessageComposerAction.EditPrevMessage:
                // selection must be collapsed and caret at start
                if (this.editorRef.current?.isSelectionCollapsed() && this.editorRef.current?.isCaretAtStart()) {
                    const events =
                        this.context.liveTimeline.getEvents()
                            .concat(replyingToThread ? [] : this.props.room.getPendingEvents());
                    const editEvent = findEditableEvent({
                        events,
                        isForward: false,
                    });
                    if (editEvent) {
                        // We're selecting history, so prevent the key event from doing anything else
                        event.preventDefault();
                        dis.dispatch({
                            action: Action.EditEvent,
                            event: editEvent,
                            timelineRenderingType: this.context.timelineRenderingType,
                        });
                    }
                }
                break;
            case MessageComposerAction.CancelEditing:
                dis.dispatch({
                    action: 'reply_to_event',
                    event: null,
                    context: this.context.timelineRenderingType,
                });
                break;
            default:
                if (this.prepareToEncrypt) {
                    // This needs to be last!
                    this.prepareToEncrypt();
                }
        }
    };

    // we keep sent messages/commands in a separate history (separate from undo history)
    // so you can alt+up/down in them
    private selectSendHistory(up: boolean): boolean {
        const delta = up ? -1 : 1;
        // True if we are not currently selecting history, but composing a message
        if (this.sendHistoryManager.currentIndex === this.sendHistoryManager.history.length) {
            // We can't go any further - there isn't any more history, so nop.
            if (!up) {
                return false;
            }
            this.currentlyComposedEditorState = this.model.serializeParts();
        } else if (this.sendHistoryManager.currentIndex + delta === this.sendHistoryManager.history.length) {
            // True when we return to the message being composed currently
            this.model.reset(this.currentlyComposedEditorState);
            this.sendHistoryManager.currentIndex = this.sendHistoryManager.history.length;
            return true;
        }
        const { parts, replyEventId } = this.sendHistoryManager.getItem(delta);
        dis.dispatch({
            action: 'reply_to_event',
            event: replyEventId ? this.props.room.findEventById(replyEventId) : null,
            context: this.context.timelineRenderingType,
        });
        if (parts) {
            this.model.reset(parts);
            this.editorRef.current?.focus();
        }
        return true;
    }

    private isSlashCommand(): boolean {
        const parts = this.model.parts;
        const firstPart = parts[0];
        if (firstPart) {
            if (firstPart.type === Type.Command && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
                return true;
            }
            // be extra resilient when somehow the AutocompleteWrapperModel or
            // CommandPartCreator fails to insert a command part, so we don't send
            // a command as a message
            if (firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")
                && (firstPart.type === Type.Plain || firstPart.type === Type.PillCandidate)) {
                return true;
            }
        }
        return false;
    }

    private sendQuickReaction(): void {
        const timeline = this.context.liveTimeline;
        const events = timeline.getEvents();
        const reaction = this.model.parts[1].text;
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].getType() === EventType.RoomMessage) {
                let shouldReact = true;
                const lastMessage = events[i];
                const userId = MatrixClientPeg.get().getUserId();
                const messageReactions = this.props.room.getUnfilteredTimelineSet()
                    .getRelationsForEvent(lastMessage.getId(), RelationType.Annotation, EventType.Reaction);

                // if we have already sent this reaction, don't redact but don't re-send
                if (messageReactions) {
                    const myReactionEvents = messageReactions.getAnnotationsBySender()[userId] || [];
                    const myReactionKeys = [...myReactionEvents]
                        .filter(event => !event.isRedacted())
                        .map(event => event.getRelation().key);
                    shouldReact = !myReactionKeys.includes(reaction);
                }
                if (shouldReact) {
                    MatrixClientPeg.get().sendEvent(lastMessage.getRoomId(), EventType.Reaction, {
                        "m.relates_to": {
                            "rel_type": RelationType.Annotation,
                            "event_id": lastMessage.getId(),
                            "key": reaction,
                        },
                    });
                    dis.dispatch({ action: "message_sent" });
                }
                break;
            }
        }
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

    private async runSlashCommand(cmd: Command, args: string): Promise<void> {
        const threadId = this.props.relation?.rel_type === RelationType.Thread
            ? this.props.relation?.event_id
            : null;

        const result = cmd.run(this.props.room.roomId, threadId, args);
        let messageContent;
        let error = result.error;
        if (result.promise) {
            try {
                if (cmd.category === CommandCategories.messages) {
                    // The command returns a modified message that we need to pass on
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

    public async sendMessage(): Promise<void> {
        const model = this.model;

        if (model.isEmpty) {
            return;
        }

        // Replace emoticon at the end of the message
        if (SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji')) {
            const indexOfLastPart = model.parts.length - 1;
            const positionInLastPart = model.parts[indexOfLastPart].text.length;
            this.editorRef.current?.replaceEmoticon(
                new DocumentPosition(indexOfLastPart, positionInLastPart),
                REGEX_EMOTICON,
            );
        }

        const replyToEvent = this.props.replyToEvent;
        let shouldSend = true;
        let content;

        if (!containsEmote(model) && this.isSlashCommand()) {
            const [cmd, args, commandText] = this.getSlashCommand();
            if (cmd) {
                if (cmd.category === CommandCategories.messages) {
                    content = await this.runSlashCommand(cmd, args);
                    if (replyToEvent) {
                        addReplyToMessageContent(
                            content,
                            replyToEvent,
                            this.props.permalinkCreator,
                        );
                    }
                    attachRelation(content, this.props.relation);
                } else {
                    this.runSlashCommand(cmd, args);
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

        if (isQuickReaction(model)) {
            shouldSend = false;
            this.sendQuickReaction();
        }

        if (shouldSend) {
            const startTime = CountlyAnalytics.getTimestamp();
            const { roomId } = this.props.room;
            if (!content) {
                content = createMessageContent(
                    model,
                    replyToEvent,
                    this.props.relation,
                    this.props.permalinkCreator,
                );
            }
            // don't bother sending an empty message
            if (!content.body.trim()) return;

            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                decorateStartSendingTime(content);
            }

            const threadId = this.props.relation?.rel_type === RelationType.Thread
                ? this.props.relation.event_id
                : null;

            const prom = this.props.mxClient.sendMessage(roomId, threadId, content);
            if (replyToEvent) {
                // Clear reply_to_event as we put the message into the queue
                // if the send fails, retry will handle resending.
                dis.dispatch({
                    action: 'reply_to_event',
                    event: null,
                    context: this.context.timelineRenderingType,
                });
            }
            dis.dispatch({ action: "message_sent" });
            CHAT_EFFECTS.forEach((effect) => {
                if (containsEmoji(content, effect.emojis)) {
                    // For initial threads launch, chat effects are disabled
                    // see #19731
                    const isNotThread = this.props.relation?.rel_type !== RelationType.Thread;
                    if (!SettingsStore.getValue("feature_thread") || isNotThread) {
                        dis.dispatch({ action: `effects.${effect.command}` });
                    }
                }
            });
            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                prom.then(resp => {
                    sendRoundTripMetric(this.props.mxClient, roomId, resp.event_id);
                });
            }
            CountlyAnalytics.instance.trackSendMessage(startTime, prom, roomId, false, !!replyToEvent, content);
        }

        this.sendHistoryManager.save(model, replyToEvent);
        // clear composer
        model.reset([]);
        this.editorRef.current?.clearUndoHistory();
        this.editorRef.current?.focus();
        this.clearStoredEditorState();
        if (SettingsStore.getValue("scrollToBottomOnMessageSent")) {
            dis.dispatch({
                action: "scroll_to_bottom",
                timelineRenderingType: this.context.timelineRenderingType,
            });
        }
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        window.removeEventListener("beforeunload", this.saveStoredEditorState);
        this.saveStoredEditorState();
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line
        const partCreator = new CommandPartCreator(this.props.room, this.props.mxClient);
        const parts = this.restoreStoredEditorState(partCreator) || [];
        this.model = new EditorModel(parts, partCreator);
        this.dispatcherRef = dis.register(this.onAction);
        this.sendHistoryManager = new SendHistoryManager(this.props.room.roomId, 'mx_cider_history_');
    }

    private get editorStateKey() {
        let key = `mx_cider_state_${this.props.room.roomId}`;
        const thread = this.props.replyToEvent?.getThread();
        if (thread) {
            key += `_${thread.id}`;
        }
        return key;
    }

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorStateKey);
    }

    private restoreStoredEditorState(partCreator: PartCreator): Part[] {
        const replyingToThread = this.props.relation?.key === RelationType.Thread;
        if (replyingToThread) {
            return null;
        }

        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const { parts: serializedParts, replyEventId } = JSON.parse(json);
                const parts: Part[] = serializedParts.map(p => partCreator.deserializePart(p));
                if (replyEventId) {
                    dis.dispatch({
                        action: 'reply_to_event',
                        event: this.props.room.findEventById(replyEventId),
                        context: this.context.timelineRenderingType,
                    });
                }
                return parts;
            } catch (e) {
                logger.error(e);
            }
        }
    }

    // should save state when editor has contents or reply is open
    private shouldSaveStoredEditorState = (): boolean => {
        return !this.model.isEmpty || !!this.props.replyToEvent;
    };

    private saveStoredEditorState = (): void => {
        if (this.shouldSaveStoredEditorState()) {
            const item = SendHistoryManager.createItem(this.model, this.props.replyToEvent);
            localStorage.setItem(this.editorStateKey, JSON.stringify(item));
        } else {
            this.clearStoredEditorState();
        }
    };

    private onAction = (payload: ActionPayload): void => {
        // don't let the user into the composer if it is disabled - all of these branches lead
        // to the cursor being in the composer
        if (this.props.disabled) return;

        switch (payload.action) {
            case 'reply_to_event':
            case Action.FocusSendMessageComposer:
                if ((payload.context ?? TimelineRenderingType.Room) === this.context.timelineRenderingType) {
                    this.editorRef.current?.focus();
                }
                break;
            case Action.ComposerInsert:
                if (payload.timelineRenderingType !== this.context.timelineRenderingType) break;
                if (payload.composerType !== ComposerType.Send) break;

                if (payload.userId) {
                    this.editorRef.current?.insertMention(payload.userId);
                } else if (payload.event) {
                    this.editorRef.current?.insertQuotedMessage(payload.event);
                } else if (payload.text) {
                    this.editorRef.current?.insertPlaintext(payload.text);
                }
                break;
        }
    };

    private onPaste = (event: ClipboardEvent<HTMLDivElement>): boolean => {
        const { clipboardData } = event;
        // Prioritize text on the clipboard over files if RTF is present as Office on macOS puts a bitmap
        // in the clipboard as well as the content being copied. Modern versions of Office seem to not do this anymore.
        // We check text/rtf instead of text/plain as when copy+pasting a file from Finder or Gnome Image Viewer
        // it puts the filename in as text/plain which we want to ignore.
        if (clipboardData.files.length && !clipboardData.types.includes("text/rtf")) {
            ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(clipboardData.files), this.props.room.roomId, this.props.relation, this.props.mxClient,
            );
            return true; // to skip internal onPaste handler
        }
    };

    private onChange = (): void => {
        if (this.props.onChange) this.props.onChange(this.model);
    };

    private focusComposer = (): void => {
        this.editorRef.current?.focus();
    };

    render() {
        const threadId = this.props.relation?.rel_type === RelationType.Thread
            ? this.props.relation.event_id
            : null;
        return (
            <div className="mx_SendMessageComposer" onClick={this.focusComposer} onKeyDown={this.onKeyDown}>
                <BasicMessageComposer
                    onChange={this.onChange}
                    ref={this.editorRef}
                    model={this.model}
                    room={this.props.room}
                    threadId={threadId}
                    label={this.props.placeholder}
                    placeholder={this.props.placeholder}
                    onPaste={this.onPaste}
                    disabled={this.props.disabled}
                />
            </div>
        );
    }
}

const SendMessageComposerWithMatrixClient = withMatrixClientHOC(SendMessageComposer);
export default SendMessageComposerWithMatrixClient;
