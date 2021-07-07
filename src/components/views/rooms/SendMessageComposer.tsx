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
import { IContent, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { DebouncedFunc, throttle } from 'lodash';
import { EventType, RelationType } from "matrix-js-sdk/src/@types/event";

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
import { CommandPartCreator, Part, PartCreator, SerializedPart } from '../../../editor/parts';
import BasicMessageComposer from "./BasicMessageComposer";
import ReplyThread from "../elements/ReplyThread";
import { findEditableEvent } from '../../../utils/EventUtils';
import SendHistoryManager from "../../../SendHistoryManager";
import { Command, CommandCategories, getCommand } from '../../../SlashCommands';
import Modal from '../../../Modal';
import { _t, _td } from '../../../languageHandler';
import ContentMessages from '../../../ContentMessages';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { Action } from "../../../dispatcher/actions";
import { containsEmoji } from "../../../effects/utils";
import { CHAT_EFFECTS } from '../../../effects';
import CountlyAnalytics from "../../../CountlyAnalytics";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { getKeyBindingsManager, MessageComposerAction } from '../../../KeyBindingsManager';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import SettingsStore from '../../../settings/SettingsStore';
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { Room } from 'matrix-js-sdk/src/models/room';
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import { ActionPayload } from "../../../dispatcher/payloads";

function addReplyToMessageContent(
    content: IContent,
    repliedToEvent: MatrixEvent,
    permalinkCreator: RoomPermalinkCreator,
): void {
    const replyContent = ReplyThread.makeReplyMixIn(repliedToEvent);
    Object.assign(content, replyContent);

    // Part of Replies fallback support - prepend the text we're sending
    // with the text we're replying to
    const nestedReply = ReplyThread.getNestedReplyText(repliedToEvent, permalinkCreator);
    if (nestedReply) {
        if (content.formatted_body) {
            content.formatted_body = nestedReply.html + content.formatted_body;
        }
        content.body = nestedReply.body + content.body;
    }
}

// exported for tests
export function createMessageContent(
    model: EditorModel,
    permalinkCreator: RoomPermalinkCreator,
    replyToEvent: MatrixEvent,
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

interface IProps {
    room: Room;
    placeholder?: string;
    permalinkCreator: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
    disabled?: boolean;
    onChange?(model: EditorModel): void;
}

@replaceableComponent("views.rooms.SendMessageComposer")
export default class SendMessageComposer extends React.Component<IProps> {
    static contextType = MatrixClientContext;
    context!: React.ContextType<typeof MatrixClientContext>;

    private readonly prepareToEncrypt?: DebouncedFunc<() => void>;
    private readonly editorRef = createRef<BasicMessageComposer>();
    private model: EditorModel = null;
    private currentlyComposedEditorState: SerializedPart[] = null;
    private dispatcherRef: string;
    private sendHistoryManager: SendHistoryManager;

    constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props);
        this.context = context; // otherwise React will only set it prior to render due to type def above
        if (this.context.isCryptoEnabled() && this.context.isRoomEncrypted(this.props.room.roomId)) {
            this.prepareToEncrypt = throttle(() => {
                this.context.prepareToEncrypt(this.props.room);
            }, 60000, { leading: true, trailing: false });
        }

        window.addEventListener("beforeunload", this.saveStoredEditorState);
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        // ignore any keypress while doing IME compositions
        if (this.editorRef.current?.isComposing(event)) {
            return;
        }
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
                    const editEvent = findEditableEvent(this.props.room, false);
                    if (editEvent) {
                        // We're selecting history, so prevent the key event from doing anything else
                        event.preventDefault();
                        dis.dispatch({
                            action: 'edit_event',
                            event: editEvent,
                        });
                    }
                }
                break;
            case MessageComposerAction.CancelEditing:
                dis.dispatch({
                    action: 'reply_to_event',
                    event: null,
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
            if (firstPart.type === "command" && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
                return true;
            }
            // be extra resilient when somehow the AutocompleteWrapperModel or
            // CommandPartCreator fails to insert a command part, so we don't send
            // a command as a message
            if (firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")
                && (firstPart.type === "plain" || firstPart.type === "pill-candidate")) {
                return true;
            }
        }
        return false;
    }

    private sendQuickReaction(): void {
        const timeline = this.props.room.getLiveTimeline();
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
        const result = cmd.run(this.props.room.roomId, args);
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

    public async sendMessage(): Promise<void> {
        if (this.model.isEmpty) {
            return;
        }

        const replyToEvent = this.props.replyToEvent;
        let shouldSend = true;
        let content;

        if (!containsEmote(this.model) && this.isSlashCommand()) {
            const [cmd, args, commandText] = this.getSlashCommand();
            if (cmd) {
                if (cmd.category === CommandCategories.messages) {
                    content = await this.runSlashCommand(cmd, args);
                    if (replyToEvent) {
                        addReplyToMessageContent(content, replyToEvent, this.props.permalinkCreator);
                    }
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

        if (isQuickReaction(this.model)) {
            shouldSend = false;
            this.sendQuickReaction();
        }

        if (shouldSend) {
            const startTime = CountlyAnalytics.getTimestamp();
            const { roomId } = this.props.room;
            if (!content) {
                content = createMessageContent(this.model, this.props.permalinkCreator, replyToEvent);
            }
            // don't bother sending an empty message
            if (!content.body.trim()) return;

            const prom = this.context.sendMessage(roomId, content);
            if (replyToEvent) {
                // Clear reply_to_event as we put the message into the queue
                // if the send fails, retry will handle resending.
                dis.dispatch({
                    action: 'reply_to_event',
                    event: null,
                });
            }
            dis.dispatch({ action: "message_sent" });
            CHAT_EFFECTS.forEach((effect) => {
                if (containsEmoji(content, effect.emojis)) {
                    dis.dispatch({ action: `effects.${effect.command}` });
                }
            });
            CountlyAnalytics.instance.trackSendMessage(startTime, prom, roomId, false, !!replyToEvent, content);
        }

        this.sendHistoryManager.save(this.model, replyToEvent);
        // clear composer
        this.model.reset([]);
        this.editorRef.current?.clearUndoHistory();
        this.editorRef.current?.focus();
        this.clearStoredEditorState();
        if (SettingsStore.getValue("scrollToBottomOnMessageSent")) {
            dis.dispatch({ action: "scroll_to_bottom" });
        }
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        window.removeEventListener("beforeunload", this.saveStoredEditorState);
        this.saveStoredEditorState();
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        const partCreator = new CommandPartCreator(this.props.room, this.context);
        const parts = this.restoreStoredEditorState(partCreator) || [];
        this.model = new EditorModel(parts, partCreator);
        this.dispatcherRef = dis.register(this.onAction);
        this.sendHistoryManager = new SendHistoryManager(this.props.room.roomId, 'mx_cider_history_');
    }

    private get editorStateKey() {
        return `mx_cider_state_${this.props.room.roomId}`;
    }

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorStateKey);
    }

    private restoreStoredEditorState(partCreator: PartCreator): Part[] {
        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const { parts: serializedParts, replyEventId } = JSON.parse(json);
                const parts: Part[] = serializedParts.map(p => partCreator.deserializePart(p));
                if (replyEventId) {
                    dis.dispatch({
                        action: 'reply_to_event',
                        event: this.props.room.findEventById(replyEventId),
                    });
                }
                return parts;
            } catch (e) {
                console.error(e);
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
            case Action.FocusComposer:
                this.editorRef.current?.focus();
                break;
            case "send_composer_insert":
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
        // Prioritize text on the clipboard over files as Office on macOS puts a bitmap
        // in the clipboard as well as the content being copied.
        if (clipboardData.files.length && !clipboardData.types.some(t => t === "text/plain")) {
            // This actually not so much for 'files' as such (at time of writing
            // neither chrome nor firefox let you paste a plain file copied
            // from Finder) but more images copied from a different website
            // / word processor etc.
            ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(clipboardData.files), this.props.room.roomId, this.context,
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
        return (
            <div className="mx_SendMessageComposer" onClick={this.focusComposer} onKeyDown={this.onKeyDown}>
                <BasicMessageComposer
                    onChange={this.onChange}
                    ref={this.editorRef}
                    model={this.model}
                    room={this.props.room}
                    label={this.props.placeholder}
                    placeholder={this.props.placeholder}
                    onPaste={this.onPaste}
                    disabled={this.props.disabled}
                />
            </div>
        );
    }
}
