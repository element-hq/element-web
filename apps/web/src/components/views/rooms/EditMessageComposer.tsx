/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type KeyboardEvent, type JSX, type MutableRefObject, type SyntheticEvent } from "react";
import classNames from "classnames";
import { EventStatus, type MatrixEvent, type Room, MsgType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type Composer as ComposerEvent } from "@matrix-org/analytics-events/types/typescript/Composer";
import {
    type ReplacementEvent,
    type RoomMessageEventContent,
    type RoomMessageTextEventContent,
} from "matrix-js-sdk/src/types";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import EditorModel from "../../../editor/model";
import { getCaretOffsetAndText } from "../../../editor/dom";
import { htmlSerializeIfNeeded, textSerialize, containsEmote, stripEmoteCommand } from "../../../editor/serialize";
import { findEditableEvent } from "../../../utils/EventUtils";
import { parseEvent } from "../../../editor/deserialize";
import { CommandPartCreator, type Part, type PartCreator, type SerializedPart } from "../../../editor/parts";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import BasicMessageComposer, { REGEX_EMOTICON } from "./BasicMessageComposer";
import { CommandCategories } from "../../../slash-commands/SlashCommands";
import { Action } from "../../../dispatcher/actions";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import SendHistoryManager from "../../../SendHistoryManager";
import { type ActionPayload } from "../../../dispatcher/payloads";
import AccessibleButton from "../elements/AccessibleButton";
import { createRedactEventDialog } from "../dialogs/ConfirmRedactDialog";
import SettingsStore from "../../../settings/SettingsStore";
import { withMatrixClientHOC, type MatrixClientProps } from "../../../contexts/MatrixClientContext";
import RoomContext from "../../../contexts/RoomContext";
import { ComposerType } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { getSlashCommand, isSlashCommand, runSlashCommand, shouldSendAnyway } from "../../../editor/commands";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { PosthogAnalytics } from "../../../PosthogAnalytics";
import { editorRoomKey, editorStateKey } from "../../../Editing";
import type DocumentOffset from "../../../editor/offset";
import { attachMentions, attachRelation } from "../../../utils/messages";
import { filterBoolean } from "../../../utils/arrays";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import ContentMessages from "../../../ContentMessages";
import { captionFromMessageContent, getEditableMediaItems, getMessageMediaItems } from "../../../utils/gallery";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { GalleryComposerViewModel } from "../../../viewmodels/composer/GalleryComposerViewModel";
import { MessageAttachments } from "./MessageAttachments";
import { type EditorActions } from "./EditorActions";

// exported for tests
export function createEditContent(
    model: EditorModel,
    editedEvent: MatrixEvent,
    replyToEvent?: MatrixEvent,
): RoomMessageEventContent {
    const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    const body = textSerialize(model);

    const newContent: RoomMessageEventContent = {
        msgtype: isEmote ? MsgType.Emote : MsgType.Text,
        body: body,
    };
    const contentBody: RoomMessageTextEventContent & Omit<ReplacementEvent<RoomMessageEventContent>, "m.relates_to"> = {
        "msgtype": newContent.msgtype,
        "body": `* ${body}`,
        "m.new_content": newContent,
    };

    const formattedBody = htmlSerializeIfNeeded(model, {
        useMarkdown: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });
    if (formattedBody) {
        newContent.format = "org.matrix.custom.html";
        newContent.formatted_body = formattedBody;
        contentBody.format = newContent.format;
        contentBody.formatted_body = `* ${formattedBody}`;
    }

    // Build the mentions properties for both the content and new_content.
    attachMentions(editedEvent.sender!.userId, contentBody, model, replyToEvent, editedEvent.getContent());
    attachRelation(contentBody, { rel_type: "m.replace", event_id: editedEvent.getId() });

    return contentBody as RoomMessageEventContent;
}

interface IEditMessageComposerProps extends MatrixClientProps {
    editState: EditorStateTransfer;
    /**
     * Function to update the URL preview view model
     */
    updateUrlPreviews?: (model: EditorModel) => void;
    /**
     * Promise to attach URL preview bundles, this should be from attachUrlPreviews
     */
    attachBundles?: (content: RoomMessageEventContent) => Promise<boolean>;
    /**
     * Whether the list of URL has been modified, even if the text content has not been changed
     */
    isUrlPreviewsModified?: boolean;
    className?: string;
    /**
     * Renders the editor inside the message composer at the bottom of the room, which shows the
     * attachments and the buttons to save and cancel in place of the editor's own.
     */
    inComposer?: boolean;
    /**
     * Reports the attachments of the message being edited, or undefined once the editor is gone,
     * for the message composer to show them.
     */
    onAttachmentsChange?: (attachments?: GalleryComposerViewModel) => void;
    /**
     * Filled with the actions of the editor, for the message composer's buttons to call.
     */
    actionsRef?: MutableRefObject<EditorActions | null>;
}
interface IState {
    saveDisabled: boolean;
    /**
     * The images and videos of the message being edited, for the user to remove items and add
     * more. Also present for a text message, which images and videos can be added to, when
     * sending them is enabled.
     */
    attachments?: GalleryComposerViewModel;
}

class EditMessageComposer extends React.Component<IEditMessageComposerProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private readonly editorRef = createRef<BasicMessageComposer>();
    private dispatcherRef?: string;
    private readonly replyToEvent?: MatrixEvent;
    private model!: EditorModel;
    private stopWatchingAttachments?: () => void;
    /** Whether the message being edited has images or videos, rather than being a text message. */
    private readonly hasMedia: boolean;
    private readonly actions: EditorActions = {
        save: () => void this.sendEdit(),
        cancel: () => this.cancelEdit(),
    };

    public constructor(props: IEditMessageComposerProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        const isRestored = this.createEditorModel();
        const ev = this.props.editState.getEvent();

        this.replyToEvent = ev.replyEventId ? this.context.room?.findEventById(ev.replyEventId) : undefined;
        this.hasMedia = getMessageMediaItems(ev.getContent()) !== undefined;

        const editContent = createEditContent(this.model, ev, this.replyToEvent);
        this.state = {
            saveDisabled: !isRestored || !this.isContentModified(editContent["m.new_content"]!),
        };
    }

    public componentDidMount(): void {
        window.addEventListener("beforeunload", this.saveStoredEditorState);
        this.dispatcherRef = dis.register(this.onAction);

        if (this.props.actionsRef) this.props.actionsRef.current = this.actions;
        if (this.props.inComposer) this.editorRef.current?.focus();

        const content = this.props.editState.getEvent().getContent();
        const mediaItems = SettingsStore.getValue("feature_gallery_messages")
            ? getEditableMediaItems(content)
            : getMessageMediaItems(content);
        if (mediaItems) {
            const attachments = new GalleryComposerViewModel({ items: mediaItems });
            // Changing the attachments is a change worth saving, just as changing the text is.
            // The view model also reports when a preview has loaded, which is not a change.
            this.stopWatchingAttachments = attachments.subscribe(() => {
                if (attachments.isModified) this.setState({ saveDisabled: false });
            });
            this.setState({ attachments });
            this.props.onAttachmentsChange?.(attachments);
            void ContentMessages.sharedInstance()
                .fetchUploadLimit(this.props.mxClient)
                .then((limit) => attachments.setMaxFileSize(limit ?? undefined));
        }
    }

    private getRoom(): Room {
        if (!this.context.room) {
            throw new Error(`Cannot render without room`);
        }
        return this.context.room;
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        // ignore any keypress while doing IME compositions
        if (this.editorRef.current?.isComposing(event)) {
            return;
        }
        const action = getKeyBindingsManager().getMessageComposerAction(event);
        switch (action) {
            case KeyBindingAction.SendMessage:
                void this.sendEdit();
                event.stopPropagation();
                event.preventDefault();
                break;
            case KeyBindingAction.CancelReplyOrEdit:
                event.stopPropagation();
                this.cancelEdit();
                break;
            case KeyBindingAction.EditPrevMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtStart()) {
                    return;
                }
                const previousEvent = findEditableEvent({
                    events: this.events,
                    isForward: false,
                    fromEventId: this.props.editState.getEvent().getId(),
                    matrixClient: MatrixClientPeg.safeGet(),
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
            case KeyBindingAction.EditNextMessage: {
                if (this.editorRef.current?.isModified() || !this.editorRef.current?.isCaretAtEnd()) {
                    return;
                }
                const nextEvent = findEditableEvent({
                    events: this.events,
                    isForward: true,
                    fromEventId: this.props.editState.getEvent().getId(),
                    matrixClient: MatrixClientPeg.safeGet(),
                });
                if (nextEvent) {
                    dis.dispatch({
                        action: Action.EditEvent,
                        event: nextEvent,
                        timelineRenderingType: this.context.timelineRenderingType,
                    });
                } else {
                    this.cancelEdit();
                }
                event.preventDefault();
                break;
            }
        }
    };

    private endEdit(): void {
        localStorage.removeItem(this.editorRoomKey);
        localStorage.removeItem(this.editorStateKey);

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
    }

    private get editorRoomKey(): string {
        return editorRoomKey(this.props.editState.getEvent().getRoomId()!, this.context.timelineRenderingType);
    }

    private get editorStateKey(): string {
        return editorStateKey(this.props.editState.getEvent().getId()!);
    }

    private get events(): MatrixEvent[] {
        const liveTimelineEvents = this.context.liveTimeline?.getEvents();
        const room = this.getRoom();
        if (!liveTimelineEvents || !room) return [];
        const pendingEvents = room.getPendingEvents();
        const isInThread = Boolean(this.props.editState.getEvent().getThread());
        return liveTimelineEvents.concat(isInThread ? [] : pendingEvents);
    }

    private cancelEdit = (): void => {
        this.endEdit();
    };

    private get shouldSaveStoredEditorState(): boolean {
        return localStorage.getItem(this.editorRoomKey) !== null;
    }

    private restoreStoredEditorState(partCreator: PartCreator): Part[] | undefined {
        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const { parts: serializedParts } = JSON.parse(json);
                const parts: Part[] = serializedParts.map((p: SerializedPart) => partCreator.deserializePart(p));
                return parts;
            } catch (e) {
                logger.error("Error parsing editing state: ", e);
            }
        }
    }

    private clearPreviousEdit(): void {
        if (localStorage.getItem(this.editorRoomKey)) {
            localStorage.removeItem(`mx_edit_state_${localStorage.getItem(this.editorRoomKey)}`);
        }
    }

    private saveStoredEditorState = (): void => {
        const item = SendHistoryManager.createItem(this.model);
        this.clearPreviousEdit();
        localStorage.setItem(this.editorRoomKey, this.props.editState.getEvent().getId()!);
        localStorage.setItem(this.editorStateKey, JSON.stringify(item));
    };

    private isContentModified(newContent: RoomMessageEventContent): boolean {
        // if nothing has changed then bail
        const oldContent = this.props.editState.getEvent().getContent<RoomMessageEventContent>();
        if (
            oldContent["msgtype"] === newContent["msgtype"] &&
            oldContent["body"] === newContent["body"] &&
            (oldContent as RoomMessageTextEventContent)["format"] ===
                (newContent as RoomMessageTextEventContent)["format"] &&
            (oldContent as RoomMessageTextEventContent)["formatted_body"] ===
                (newContent as RoomMessageTextEventContent)["formatted_body"]
        ) {
            return false;
        }
        return true;
    }

    /**
     * Save the edit of a message with images or videos: the text of the editor becomes its
     * caption, and the attachments are what is left of them after the user's changes.
     */
    private sendMediaEdit(attachments: GalleryComposerViewModel): void {
        const editedEvent = this.props.editState.getEvent();
        const editContent = createEditContent(this.model, editedEvent, this.replyToEvent);
        const items = attachments.getItems();

        if (items.length === 0 && editContent["m.new_content"]!.body === "") {
            // Nothing is left of the message, so offer to remove it, as for an emptied text message.
            this.cancelPreviousPendingEdit();
            createRedactEventDialog({
                mxEvent: editedEvent,
                onCloseDialog: () => {
                    this.cancelEdit();
                },
            });
            return;
        }

        this.cancelPreviousPendingEdit();
        this.endEdit();
        void ContentMessages.sharedInstance().editMediaMessage(
            editedEvent,
            this.props.mxClient,
            items,
            captionFromMessageContent(editContent["m.new_content"]!),
            editContent["m.mentions"],
        );
    }

    private sendEdit = async (): Promise<void> => {
        if (this.state.saveDisabled && !this.props.isUrlPreviewsModified) return;

        const editedEvent = this.props.editState.getEvent();

        PosthogAnalytics.instance.trackEvent<ComposerEvent>({
            eventName: "Composer",
            isEditing: true,
            messageType: "Text",
            inThread: !!editedEvent?.getThread(),
            isReply: !!editedEvent.replyEventId,
        });

        // Replace emoticon at the end of the message
        if (SettingsStore.getValue("MessageComposerInput.autoReplaceEmoji") && this.editorRef.current) {
            const caret = this.editorRef.current.getCaret();
            const position = this.model.positionForOffset(caret.offset, caret.atNodeEnd);
            this.editorRef.current.replaceEmoticon(position, REGEX_EMOTICON);
        }

        // A text message stays one, with all that goes with it, unless images or videos were added.
        if (this.state.attachments && (this.hasMedia || this.state.attachments.isModified)) {
            this.sendMediaEdit(this.state.attachments);
            return;
        }

        const editContent = createEditContent(this.model, editedEvent, this.replyToEvent);
        const newContent = editContent["m.new_content"]!;

        let shouldSend = true;

        if (newContent?.body === "") {
            this.cancelPreviousPendingEdit();
            createRedactEventDialog({
                mxEvent: editedEvent,
                onCloseDialog: () => {
                    this.cancelEdit();
                },
            });
            return;
        }

        // If content is modified then send an updated event into the room
        // either text content or list of URL previews modified counts
        if (this.isContentModified(newContent) || this.props.isUrlPreviewsModified) {
            const roomId = editedEvent.getRoomId()!;
            if (!containsEmote(this.model) && isSlashCommand(this.model)) {
                const [cmd, args, commandText] = getSlashCommand(roomId, this.model);
                if (cmd) {
                    const threadId = editedEvent?.getThread()?.id || null;
                    const [content, commandSuccessful] = await runSlashCommand(
                        MatrixClientPeg.safeGet(),
                        cmd,
                        args,
                        roomId,
                        threadId,
                    );
                    if (!commandSuccessful) {
                        return; // errored
                    }

                    if (cmd.category === CommandCategories.messages || cmd.category === CommandCategories.effects) {
                        editContent["m.new_content"] = content!;
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
            if (shouldSend) {
                this.cancelPreviousPendingEdit();

                const event = this.props.editState.getEvent();
                const threadId = event.threadRootId || null;

                // the previews are read synchronously, so the editor can be closed straight away
                // rather than making the user wait for any preview images to upload
                const attachingPromise = this.props.attachBundles?.(editContent["m.new_content"]!);
                this.endEdit();

                // the edit was cancelled while its preview images were uploading
                if (await attachingPromise) return;

                void this.props.mxClient.sendMessage(roomId, threadId, editContent);
                dis.dispatch({ action: "message_sent" });
                return;
            }
        }

        this.endEdit();
    };

    private cancelPreviousPendingEdit(): void {
        const originalEvent = this.props.editState.getEvent();
        const previousEdit = originalEvent.replacingEvent();
        if (
            previousEdit &&
            (previousEdit.status === EventStatus.QUEUED || previousEdit.status === EventStatus.NOT_SENT)
        ) {
            this.props.mxClient.cancelPendingEvent(previousEdit);
        }
    }

    public componentWillUnmount(): void {
        // store caret and serialized parts in the
        // editorstate so it can be restored when the remote echo event tile gets rendered
        // in case we're currently editing a pending event
        const sel = document.getSelection()!;
        let caret: DocumentOffset | undefined;
        if (sel.focusNode && this.editorRef.current?.editorRef.current) {
            caret = getCaretOffsetAndText(this.editorRef.current.editorRef.current, sel).caret;
        }
        const parts = this.model.serializeParts();
        // if caret is undefined because for some reason there isn't a valid selection,
        // then when mounting the editor again with the same editor state,
        // it will set the cursor at the end.
        this.props.editState.setEditorState(caret ?? null, parts);
        window.removeEventListener("beforeunload", this.saveStoredEditorState);
        if (this.shouldSaveStoredEditorState) {
            this.saveStoredEditorState();
        }
        dis.unregister(this.dispatcherRef);
        this.stopWatchingAttachments?.();
        if (this.state.attachments) this.props.onAttachmentsChange?.(undefined);
        this.state.attachments?.dispose();
        if (this.props.actionsRef?.current === this.actions) this.props.actionsRef.current = null;
    }

    /**
     * Files pasted or dropped into the editor are attached to the message, when it can have any.
     */
    private onPaste = (_event: Event | SyntheticEvent, data: DataTransfer): boolean => {
        const { attachments } = this.state;
        if (!attachments || data.files.length === 0) return false;
        // Files which cannot be attached are left out with a notice, by the attachments themselves.
        attachments.onAddFiles(Array.from(data.files));
        return true;
    };

    private createEditorModel(): boolean {
        const { editState } = this.props;
        const room = this.getRoom();
        const partCreator = new CommandPartCreator(room, this.props.mxClient);

        let parts: Part[];
        let isRestored = false;
        if (editState.hasEditorState()) {
            // if restoring state from a previous editor,
            // restore serialized parts from the state
            // (editState.hasEditorState() checks getSerializedParts is not null)
            parts = filterBoolean<Part>(editState.getSerializedParts()!.map((p) => partCreator.deserializePart(p)));
        } else {
            // otherwise, either restore serialized parts from localStorage or parse the body of the event
            const restoredParts = this.restoreStoredEditorState(partCreator);
            const event = editState.getEvent();
            // The body of an image or video without a caption is its file name, which is not
            // text to edit: the editor starts empty, for a caption to be written.
            const hasText = !getMessageMediaItems(event.getContent()) || MediaEventHelper.hasCaption(event);
            parts =
                restoredParts ||
                (hasText
                    ? parseEvent(event, partCreator, {
                          shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
                      })
                    : []);
            isRestored = !!restoredParts;
        }
        this.model = new EditorModel(parts, partCreator);
        this.saveStoredEditorState();

        return isRestored;
    }

    private onChange = (): void => {
        this.props.updateUrlPreviews?.(this.model);

        if (!this.state.saveDisabled || !this.editorRef.current?.isModified()) {
            return;
        }

        this.setState({
            saveDisabled: false,
        });
    };

    private onAction = (payload: ActionPayload): void => {
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

    public render(): React.ReactNode {
        const room = this.getRoom();
        if (!room) return null;

        return (
            <div
                className={classNames(
                    "mx_EditMessageComposer",
                    { mx_EditMessageComposer_inComposer: this.props.inComposer },
                    this.props.className,
                )}
                onKeyDown={this.onKeyDown}
            >
                <BasicMessageComposer
                    ref={this.editorRef}
                    model={this.model}
                    room={room}
                    threadId={this.props.editState?.getEvent()?.getThread()?.id}
                    initialCaret={this.props.editState.getCaret() ?? undefined}
                    label={_t("composer|edit_composer_label")}
                    onChange={this.onChange}
                    onPaste={this.onPaste}
                />
                {/* Below the text rather than above it, where the formatting bar pops up over a selection.
                    In the message composer, the composer shows them instead. */}
                {this.state.attachments && !this.props.inComposer && (
                    <MessageAttachments
                        vm={this.state.attachments}
                        alwaysShow={this.hasMedia}
                        className="mx_EditMessageComposer_attachments"
                    />
                )}
                {!this.props.inComposer && this.renderButtons()}
            </div>
        );
    }

    private renderButtons(): JSX.Element {
        return (
            <div className="mx_EditMessageComposer_buttons">
                <AccessibleButton kind="secondary" onClick={this.cancelEdit}>
                    {_t("action|cancel")}
                </AccessibleButton>
                <AccessibleButton
                    kind="primary"
                    onClick={this.sendEdit}
                    disabled={this.state.saveDisabled && !this.props.isUrlPreviewsModified}
                >
                    {_t("action|save")}
                </AccessibleButton>
            </div>
        );
    }
}

const EditMessageComposerWithMatrixClient = withMatrixClientHOC(EditMessageComposer);
export default EditMessageComposerWithMatrixClient;
