/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type KeyboardEvent, type SyntheticEvent } from "react";
import {
    type IContent,
    type MatrixEvent,
    type IEventRelation,
    type IMentions,
    type Room,
    EventType,
    MsgType,
    RelationType,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { type DebouncedFunc, throttle } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";
import { type Composer as ComposerEvent } from "@matrix-org/analytics-events/types/typescript/Composer";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import dis from "../../../dispatcher/dispatcher";
import EditorModel from "../../../editor/model";
import {
    containsEmote,
    htmlSerializeIfNeeded,
    startsWith,
    stripEmoteCommand,
    stripPrefix,
    textSerialize,
    unescapeMessage,
} from "../../../editor/serialize";
import BasicMessageComposer, { REGEX_EMOTICON } from "./BasicMessageComposer";
import { CommandPartCreator, type Part, type PartCreator, type SerializedPart, Type } from "../../../editor/parts";
import { findEditableEvent } from "../../../utils/EventUtils";
import SendHistoryManager from "../../../SendHistoryManager";
import { CommandCategories } from "../../../SlashCommands";
import ContentMessages from "../../../ContentMessages";
import { withMatrixClientHOC, type MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { Action } from "../../../dispatcher/actions";
import { containsEmoji } from "../../../effects/utils";
import { CHAT_EFFECTS } from "../../../effects";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import SettingsStore from "../../../settings/SettingsStore";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { decorateStartSendingTime, sendRoundTripMetric } from "../../../sendTimePerformanceMetrics";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import DocumentPosition from "../../../editor/position";
import { ComposerType } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { getSlashCommand, isSlashCommand, runSlashCommand, shouldSendAnyway } from "../../../editor/commands";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { PosthogAnalytics } from "../../../PosthogAnalytics";
import { addReplyToMessageContent } from "../../../utils/Reply";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import { type Caret } from "../../../editor/caret";
import { type IDiff } from "../../../editor/diff";
import { getBlobSafeMimeType } from "../../../utils/blobs";
import { EMOJI_REGEX } from "../../../HtmlUtils";

// The prefix used when persisting editor drafts to localstorage.
export const EDITOR_STATE_STORAGE_PREFIX = "mx_cider_state_";

/**
 * Build the mentions information based on the editor model (and any related events):
 *
 * 1. Search the model parts for room or user pills and fill in the mentions object.
 * 2. If this is a reply to another event, include any user mentions from that
 *    (but do not include a room mention).
 *
 * @param sender - The Matrix ID of the user sending the event.
 * @param content - The event content.
 * @param model - The editor model to search for mentions, null if there is no editor.
 * @param replyToEvent - The event being replied to or undefined if it is not a reply.
 * @param editedContent - The content of the parent event being edited.
 */
export function attachMentions(
    sender: string,
    content: IContent,
    model: EditorModel | null,
    replyToEvent: MatrixEvent | undefined,
    editedContent: IContent | null = null,
): void {
    // We always attach the mentions even if the home server doesn't yet support
    // intentional mentions. This is safe because m.mentions is an additive change
    // that should simply be ignored by incapable home servers.

    // The mentions property *always* gets included to disable legacy push rules.
    const mentions: IMentions = (content["m.mentions"] = {});

    const userMentions = new Set<string>();
    let roomMention = false;

    // If there's a reply, initialize the mentioned users as the sender of that event.
    if (replyToEvent) {
        userMentions.add(replyToEvent.sender!.userId);
    }

    // If user provided content is available, check to see if any users are mentioned.
    if (model) {
        // Add any mentioned users in the current content.
        for (const part of model.parts) {
            if (part.type === Type.UserPill) {
                userMentions.add(part.resourceId);
            } else if (part.type === Type.AtRoomPill) {
                roomMention = true;
            }
        }
    }

    // Ensure the *current* user isn't listed in the mentioned users.
    userMentions.delete(sender);

    // Finally, if this event is editing a previous event, only include users who
    // were not previously mentioned and a room mention if the previous event was
    // not a room mention.
    if (editedContent) {
        // First, the new event content gets the *full* set of users.
        const newContent = content["m.new_content"];
        const newMentions: IMentions = (newContent["m.mentions"] = {});

        // Only include the users/room if there is any content.
        if (userMentions.size) {
            newMentions.user_ids = [...userMentions];
        }
        if (roomMention) {
            newMentions.room = true;
        }

        // Fetch the mentions from the original event and remove any previously
        // mentioned users.
        const prevMentions = editedContent["m.mentions"];
        if (Array.isArray(prevMentions?.user_ids)) {
            prevMentions!.user_ids.forEach((userId) => userMentions.delete(userId));
        }

        // If the original event mentioned the room, nothing to do here.
        if (prevMentions?.room) {
            roomMention = false;
        }
    }

    // Only include the users/room if there is any content.
    if (userMentions.size) {
        mentions.user_ids = [...userMentions];
    }
    if (roomMention) {
        mentions.room = true;
    }
}

// Merges favouring the given relation
export function attachRelation(content: IContent, relation?: IEventRelation): void {
    if (relation) {
        content["m.relates_to"] = {
            ...(content["m.relates_to"] || {}),
            ...relation,
        };
    }
}

// exported for tests
export function createMessageContent(
    sender: string,
    model: EditorModel,
    replyToEvent: MatrixEvent | undefined,
    relation: IEventRelation | undefined,
): RoomMessageEventContent {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    if (startsWith(model, "//")) {
        model = stripPrefix(model, "/");
    }
    model = unescapeMessage(model);

    const body = textSerialize(model);

    const content: RoomMessageEventContent = {
        msgtype: isEmote ? MsgType.Emote : MsgType.Text,
        body: body,
    };
    const formattedBody = htmlSerializeIfNeeded(model, {
        useMarkdown: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });
    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
    }

    // Build the mentions property and add it to the event content.
    attachMentions(sender, content, model, replyToEvent);

    attachRelation(content, relation);
    if (replyToEvent) {
        addReplyToMessageContent(content, replyToEvent);
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
            return emojiMatch[0] === text.substring(1) || emojiMatch[0] === text.substring(2);
        }
    }
    return false;
}

interface ISendMessageComposerProps extends MatrixClientProps {
    room: Room;
    placeholder?: string;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    disabled?: boolean;
    onChange?(model: EditorModel): void;
    toggleStickerPickerOpen: () => void;
}

export class SendMessageComposer extends React.Component<ISendMessageComposerProps> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private readonly prepareToEncrypt?: DebouncedFunc<() => void>;
    private readonly editorRef = createRef<BasicMessageComposer>();
    private model: EditorModel;
    private currentlyComposedEditorState: SerializedPart[] | null = null;
    private dispatcherRef?: string;
    private sendHistoryManager: SendHistoryManager;

    public constructor(props: ISendMessageComposerProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        if (this.props.mxClient.getCrypto() && this.props.mxClient.isRoomEncrypted(this.props.room.roomId)) {
            this.prepareToEncrypt = throttle(
                () => {
                    this.props.mxClient.getCrypto()?.prepareToEncrypt(this.props.room);
                },
                60000,
                { leading: true, trailing: false },
            );
        }

        const partCreator = new CommandPartCreator(this.props.room, this.props.mxClient);
        const parts = this.restoreStoredEditorState(partCreator) || [];
        this.model = new EditorModel(parts, partCreator);
        this.sendHistoryManager = new SendHistoryManager(this.props.room.roomId, "mx_cider_history_");
    }

    public componentDidMount(): void {
        window.addEventListener("beforeunload", this.saveStoredEditorState);
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentDidUpdate(prevProps: ISendMessageComposerProps): void {
        const replyingToThread = this.props.relation?.key === THREAD_RELATION_TYPE.name;
        const differentEventTarget = this.props.relation?.event_id !== prevProps.relation?.event_id;

        const threadChanged = replyingToThread && differentEventTarget;
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
        const replyingToThread = this.props.relation?.key === THREAD_RELATION_TYPE.name;
        const action = getKeyBindingsManager().getMessageComposerAction(event);
        switch (action) {
            case KeyBindingAction.SendMessage:
                this.sendMessage();
                event.preventDefault();
                break;
            case KeyBindingAction.SelectPrevSendHistory:
            case KeyBindingAction.SelectNextSendHistory: {
                // Try select composer history
                const selected = this.selectSendHistory(action === KeyBindingAction.SelectPrevSendHistory);
                if (selected) {
                    // We're selecting history, so prevent the key event from doing anything else
                    event.preventDefault();
                }
                break;
            }
            case KeyBindingAction.ShowStickerPicker: {
                if (!SettingsStore.getValue("MessageComposerInput.showStickersButton")) {
                    return; // Do nothing if there is no Stickers button
                }
                this.props.toggleStickerPickerOpen();
                event.preventDefault();
                break;
            }
            case KeyBindingAction.EditPrevMessage:
                // selection must be collapsed and caret at start
                if (this.editorRef.current?.isSelectionCollapsed() && this.editorRef.current?.isCaretAtStart()) {
                    const events = this.context.liveTimeline
                        ?.getEvents()
                        .concat(replyingToThread ? [] : this.props.room.getPendingEvents());
                    const editEvent = events
                        ? findEditableEvent({
                              events,
                              isForward: false,
                              matrixClient: MatrixClientPeg.safeGet(),
                          })
                        : undefined;
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
            case KeyBindingAction.CancelReplyOrEdit:
                if (!!this.context.replyToEvent) {
                    dis.dispatch({
                        action: "reply_to_event",
                        event: null,
                        context: this.context.timelineRenderingType,
                    });
                    event.preventDefault();
                    event.stopPropagation();
                }
                break;
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
        } else if (
            this.currentlyComposedEditorState &&
            this.sendHistoryManager.currentIndex + delta === this.sendHistoryManager.history.length
        ) {
            // True when we return to the message being composed currently
            this.model.reset(this.currentlyComposedEditorState);
            this.sendHistoryManager.currentIndex = this.sendHistoryManager.history.length;
            return true;
        }
        const { parts, replyEventId } = this.sendHistoryManager.getItem(delta);
        dis.dispatch({
            action: "reply_to_event",
            event: replyEventId ? this.props.room.findEventById(replyEventId) : null,
            context: this.context.timelineRenderingType,
        });
        if (parts) {
            this.model.reset(parts);
            this.editorRef.current?.focus();
        }
        return true;
    }

    private sendQuickReaction(): void {
        const timeline = this.context.liveTimeline;
        if (!timeline) return;
        const events = timeline.getEvents();
        const reaction = this.model.parts[1].text;
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].getType() === EventType.RoomMessage) {
                let shouldReact = true;
                const lastMessage = events[i];
                const userId = MatrixClientPeg.safeGet().getSafeUserId();
                const messageReactions = this.props.room.relations.getChildEventsForEvent(
                    lastMessage.getId()!,
                    RelationType.Annotation,
                    EventType.Reaction,
                );

                // if we have already sent this reaction, don't redact but don't re-send
                if (messageReactions) {
                    const myReactionEvents =
                        messageReactions.getAnnotationsBySender()?.[userId] || new Set<MatrixEvent>();
                    const myReactionKeys = [...myReactionEvents]
                        .filter((event) => !event.isRedacted())
                        .map((event) => event.getRelation()?.key);
                    shouldReact = !myReactionKeys.includes(reaction);
                }
                if (shouldReact) {
                    MatrixClientPeg.safeGet().sendEvent(lastMessage.getRoomId()!, EventType.Reaction, {
                        "m.relates_to": {
                            rel_type: RelationType.Annotation,
                            event_id: lastMessage.getId()!,
                            key: reaction,
                        },
                    });
                    dis.dispatch({ action: "message_sent" });
                }
                break;
            }
        }
    }

    public async sendMessage(): Promise<void> {
        const model = this.model;

        if (model.isEmpty) {
            return;
        }

        const posthogEvent: ComposerEvent = {
            eventName: "Composer",
            isEditing: false,
            messageType: "Text",
            isReply: !!this.props.replyToEvent,
            inThread: this.props.relation?.rel_type === THREAD_RELATION_TYPE.name,
        };
        if (posthogEvent.inThread && this.props.relation!.event_id) {
            const threadRoot = this.props.room.findEventById(this.props.relation!.event_id);
            posthogEvent.startsThread = threadRoot?.getThread()?.events.length === 1;
        }
        PosthogAnalytics.instance.trackEvent<ComposerEvent>(posthogEvent);

        // Replace emoticon at the end of the message
        if (SettingsStore.getValue("MessageComposerInput.autoReplaceEmoji")) {
            const indexOfLastPart = model.parts.length - 1;
            const positionInLastPart = model.parts[indexOfLastPart].text.length;
            this.editorRef.current?.replaceEmoticon(
                new DocumentPosition(indexOfLastPart, positionInLastPart),
                REGEX_EMOTICON,
            );
        }

        const replyToEvent = this.props.replyToEvent;
        let shouldSend = true;
        let content: RoomMessageEventContent | null = null;

        if (!containsEmote(model) && isSlashCommand(this.model)) {
            const [cmd, args, commandText] = getSlashCommand(this.model);
            if (cmd) {
                const threadId =
                    this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation?.event_id : null;

                let commandSuccessful: boolean;
                [content, commandSuccessful] = await runSlashCommand(
                    MatrixClientPeg.safeGet(),
                    cmd,
                    args,
                    this.props.room.roomId,
                    threadId ?? null,
                );
                if (!commandSuccessful) {
                    return; // errored
                }

                if (
                    content &&
                    [CommandCategories.messages as string, CommandCategories.effects as string].includes(cmd.category)
                ) {
                    // Attach any mentions which might be contained in the command content.
                    attachMentions(this.props.mxClient.getSafeUserId(), content, model, replyToEvent);
                    attachRelation(content, this.props.relation);
                    if (replyToEvent) {
                        addReplyToMessageContent(content, replyToEvent);
                    }
                } else {
                    shouldSend = false;
                }
            } else {
                const sendAnyway = await shouldSendAnyway(commandText);
                // re-focus the composer after QuestionDialog is closed
                dis.dispatch({
                    action: Action.FocusAComposer,
                    context: this.context.timelineRenderingType,
                });
                // if !sendAnyway bail to let the user edit the composer and try again
                if (!sendAnyway) return;
            }
        }

        if (isQuickReaction(model)) {
            shouldSend = false;
            this.sendQuickReaction();
        }

        if (shouldSend) {
            const { roomId } = this.props.room;
            if (!content) {
                content = createMessageContent(
                    this.props.mxClient.getSafeUserId(),
                    model,
                    replyToEvent,
                    this.props.relation,
                );
            }
            // don't bother sending an empty message
            if (!content.body.trim()) return;

            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                decorateStartSendingTime(content);
            }

            const threadId =
                this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation.event_id : null;

            const prom = doMaybeLocalRoomAction(
                roomId,
                (actualRoomId: string) => this.props.mxClient.sendMessage(actualRoomId, threadId ?? null, content!),
                this.props.mxClient,
            );
            if (replyToEvent) {
                // Clear reply_to_event as we put the message into the queue
                // if the send fails, retry will handle resending.
                dis.dispatch({
                    action: "reply_to_event",
                    event: null,
                    context: this.context.timelineRenderingType,
                });
            }
            dis.dispatch({ action: "message_sent" });
            CHAT_EFFECTS.forEach((effect) => {
                if (containsEmoji(content!, effect.emojis)) {
                    // For initial threads launch, chat effects are disabled
                    // see #19731
                    const isNotThread = this.props.relation?.rel_type !== THREAD_RELATION_TYPE.name;
                    if (isNotThread) {
                        dis.dispatch({ action: `effects.${effect.command}` });
                    }
                }
            });
            if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
                prom.then((resp) => {
                    sendRoundTripMetric(this.props.mxClient, roomId, resp.event_id);
                });
            }
        }

        this.sendHistoryManager.save(model, replyToEvent);
        // clear composer
        model.reset([]);
        this.editorRef.current?.clearUndoHistory();
        this.editorRef.current?.focus();
        this.clearStoredEditorState();
        if (shouldSend && SettingsStore.getValue("scrollToBottomOnMessageSent")) {
            dis.dispatch({
                action: "scroll_to_bottom",
                timelineRenderingType: this.context.timelineRenderingType,
            });
        }
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
        window.removeEventListener("beforeunload", this.saveStoredEditorState);
        this.saveStoredEditorState();
    }

    private get editorStateKey(): string {
        let key = EDITOR_STATE_STORAGE_PREFIX + this.props.room.roomId;
        if (this.props.relation?.rel_type === THREAD_RELATION_TYPE.name) {
            key += `_${this.props.relation.event_id}`;
        }
        return key;
    }

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorStateKey);
    }

    private restoreStoredEditorState(partCreator: PartCreator): Part[] | null {
        const replyingToThread = this.props.relation?.key === THREAD_RELATION_TYPE.name;
        if (replyingToThread) {
            return null;
        }

        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const { parts: serializedParts, replyEventId } = JSON.parse(json);
                const parts: Part[] = serializedParts.map((p: SerializedPart) => partCreator.deserializePart(p));
                if (replyEventId) {
                    dis.dispatch({
                        action: "reply_to_event",
                        event: this.props.room.findEventById(replyEventId),
                        context: this.context.timelineRenderingType,
                    });
                }
                return parts;
            } catch (e) {
                logger.error(e);
            }
        }

        return null;
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
            case "reply_to_event":
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

    private onPaste = (event: Event | SyntheticEvent, data: DataTransfer): boolean => {
        // Prioritize text on the clipboard over files if RTF is present as Office on macOS puts a bitmap
        // in the clipboard as well as the content being copied. Modern versions of Office seem to not do this anymore.
        // We check text/rtf instead of text/plain as when copy+pasting a file from Finder or Gnome Image Viewer
        // it puts the filename in as text/plain which we want to ignore.
        if (data.files.length && !data.types.includes("text/rtf")) {
            ContentMessages.sharedInstance().sendContentListToRoom(
                Array.from(data.files),
                this.props.room.roomId,
                this.props.relation,
                this.props.mxClient,
                this.context.timelineRenderingType,
            );
            return true; // to skip internal onPaste handler
        }

        // Safari `Insert from iPhone or iPad`
        // data.getData("text/html") returns a string like: <img src="blob:https://...">
        if (data.types.includes("text/html")) {
            const imgElementStr = data.getData("text/html");
            const parser = new DOMParser();
            const imgDoc = parser.parseFromString(imgElementStr, "text/html");

            if (
                imgDoc.getElementsByTagName("img").length !== 1 ||
                !imgDoc.querySelector("img")?.src.startsWith("blob:") ||
                imgDoc.childNodes.length !== 1
            ) {
                console.log("Failed to handle pasted content as Safari inserted content");

                // Fallback to internal onPaste handler
                return false;
            }
            const imgSrc = imgDoc!.querySelector("img")!.src;

            fetch(imgSrc).then(
                (response) => {
                    response.blob().then(
                        (imgBlob) => {
                            const type = imgBlob.type;
                            const safetype = getBlobSafeMimeType(type);
                            const ext = type.split("/")[1];
                            const parts = response.url.split("/");
                            const filename = parts[parts.length - 1];
                            const file = new File([imgBlob], filename + "." + ext, { type: safetype });
                            ContentMessages.sharedInstance().sendContentToRoom(
                                file,
                                this.props.room.roomId,
                                this.props.relation,
                                this.props.mxClient,
                                this.context.replyToEvent,
                            );
                        },
                        (error) => {
                            console.log(error);
                        },
                    );
                },
                (error) => {
                    console.log(error);
                },
            );

            // Skip internal onPaste handler
            return true;
        }

        return false;
    };

    private onChange = (selection?: Caret, inputType?: string, diff?: IDiff): void => {
        // We call this in here rather than onKeyDown as that would trip it on global shortcuts e.g. Ctrl-k also
        if (!!diff) {
            this.prepareToEncrypt?.();
        }

        this.props.onChange?.(this.model);
    };

    private focusComposer = (): void => {
        this.editorRef.current?.focus();
    };

    public render(): React.ReactNode {
        const threadId =
            this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation.event_id : undefined;
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
