/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type ReactNode } from "react";
import classNames from "classnames";
import {
    type IEventRelation,
    type MatrixEvent,
    type Room,
    type RoomMember,
    EventType,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";
import { Tooltip } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
import Stickerpicker from "./Stickerpicker";
import { makeRoomPermalink, type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import E2EIcon from "./E2EIcon";
import SettingsStore from "../../../settings/SettingsStore";
import { aboveLeftOf, type MenuProps } from "../../structures/ContextMenu";
import ReplyPreview from "./ReplyPreview";
import { UserIdentityWarning } from "./UserIdentityWarning";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import VoiceRecordComposerTile from "./VoiceRecordComposerTile";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { RecordingState } from "../../../audio/VoiceRecording";
import type ResizeNotifier from "../../../utils/ResizeNotifier";
import { type E2EStatus } from "../../../utils/ShieldUtils";
import SendMessageComposer, { type SendMessageComposer as SendMessageComposerClass } from "./SendMessageComposer";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import type EditorModel from "../../../editor/model";
import UIStore, { UI_EVENTS } from "../../../stores/UIStore";
import RoomContext from "../../../contexts/RoomContext";
import { type SettingUpdatedPayload } from "../../../dispatcher/payloads/SettingUpdatedPayload";
import MessageComposerButtons from "./MessageComposerButtons";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";
import { type VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";
import { SendWysiwygComposer, sendMessage, getConversionFunctions } from "./wysiwyg_composer/";
import { type MatrixClientProps, withMatrixClientHOC } from "../../../contexts/MatrixClientContext";
import { UIFeature } from "../../../settings/UIFeature";
import { formatTimeLeft } from "../../../DateUtils";
import RoomReplacedSvg from "../../../../res/img/room_replaced.svg";

// The prefix used when persisting editor drafts to localstorage.
export const WYSIWYG_EDITOR_STATE_STORAGE_PREFIX = "mx_wysiwyg_state_";

let instanceCount = 0;

interface ISendButtonProps {
    onClick: (ev: ButtonEvent) => void;
    title?: string; // defaults to something generic
}

function SendButton(props: ISendButtonProps): JSX.Element {
    return (
        <AccessibleButton
            className="mx_MessageComposer_sendMessage"
            onClick={props.onClick}
            title={props.title ?? _t("composer|send_button_title")}
            data-testid="sendmessagebtn"
        />
    );
}

interface IProps extends MatrixClientProps {
    room: Room;
    resizeNotifier: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
    relation?: IEventRelation;
    e2eStatus?: E2EStatus;
    compact?: boolean;
}

interface IState {
    composerContent: string;
    isComposerEmpty: boolean;
    haveRecording: boolean;
    recordingTimeLeftSeconds?: number;
    me?: RoomMember;
    isMenuOpen: boolean;
    isStickerPickerOpen: boolean;
    showStickersButton: boolean;
    showPollsButton: boolean;
    isWysiwygLabEnabled: boolean;
    isRichTextEnabled: boolean;
    initialComposerContent: string;
}

type WysiwygComposerState = {
    content: string;
    isRichText: boolean;
    replyEventId?: string;
};

export class MessageComposer extends React.Component<IProps, IState> {
    private dispatcherRef?: string;
    private messageComposerInput = createRef<SendMessageComposerClass>();
    private voiceRecordingButton = createRef<VoiceRecordComposerTile>();
    private ref: React.RefObject<HTMLDivElement> = createRef();
    private instanceId: number;

    private _voiceRecording: Optional<VoiceMessageRecording>;

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public static defaultProps = {
        compact: false,
        isRichTextEnabled: true,
    };

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);
        this.context = context; // otherwise React will only set it prior to render due to type def above

        const isWysiwygLabEnabled = SettingsStore.getValue("feature_wysiwyg_composer");
        let isRichTextEnabled = true;
        let initialComposerContent = "";
        if (isWysiwygLabEnabled) {
            const wysiwygState = this.restoreWysiwygEditorState();
            if (wysiwygState) {
                isRichTextEnabled = wysiwygState.isRichText;
                initialComposerContent = wysiwygState.content;
            }
        }

        this.state = {
            isComposerEmpty: initialComposerContent?.length === 0,
            composerContent: initialComposerContent,
            haveRecording: false,
            recordingTimeLeftSeconds: undefined, // when set to a number, shows a toast
            isMenuOpen: false,
            isStickerPickerOpen: false,
            showStickersButton: SettingsStore.getValue("MessageComposerInput.showStickersButton"),
            showPollsButton: SettingsStore.getValue("MessageComposerInput.showPollsButton"),
            isWysiwygLabEnabled: isWysiwygLabEnabled,
            isRichTextEnabled: isRichTextEnabled,
            initialComposerContent: initialComposerContent,
        };

        this.instanceId = instanceCount++;
    }

    private get editorStateKey(): string {
        let key = WYSIWYG_EDITOR_STATE_STORAGE_PREFIX + this.props.room.roomId;
        if (this.props.relation?.rel_type === THREAD_RELATION_TYPE.name) {
            key += `_${this.props.relation.event_id}`;
        }
        return key;
    }

    private restoreWysiwygEditorState(): WysiwygComposerState | undefined {
        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const state: WysiwygComposerState = JSON.parse(json);
                return state;
            } catch (e) {
                logger.error(e);
            }
        }
        return undefined;
    }

    private saveWysiwygEditorState = (): void => {
        if (this.shouldSaveWysiwygEditorState()) {
            const { isRichTextEnabled, composerContent } = this.state;
            const replyEventId = this.props.replyToEvent ? this.props.replyToEvent.getId() : undefined;
            const item: WysiwygComposerState = {
                content: composerContent,
                isRichText: isRichTextEnabled,
                replyEventId: replyEventId,
            };
            localStorage.setItem(this.editorStateKey, JSON.stringify(item));
        } else {
            this.clearStoredEditorState();
        }
    };

    // should save state when wysiwyg is enabled and has contents or reply is open
    private shouldSaveWysiwygEditorState = (): boolean => {
        const { isWysiwygLabEnabled, isComposerEmpty } = this.state;
        return isWysiwygLabEnabled && (!isComposerEmpty || !!this.props.replyToEvent);
    };

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorStateKey);
    }

    private get voiceRecording(): Optional<VoiceMessageRecording> {
        return this._voiceRecording;
    }

    private set voiceRecording(rec: Optional<VoiceMessageRecording>) {
        if (this._voiceRecording) {
            this._voiceRecording.off(RecordingState.Started, this.onRecordingStarted);
            this._voiceRecording.off(RecordingState.EndingSoon, this.onRecordingEndingSoon);
        }

        this._voiceRecording = rec;

        if (rec) {
            // Delay saying we have a recording until it is started, as we might not yet
            // have A/V permissions
            rec.on(RecordingState.Started, this.onRecordingStarted);

            // We show a little heads up that the recording is about to automatically end soon. The 3s
            // display time is completely arbitrary.
            rec.on(RecordingState.EndingSoon, this.onRecordingEndingSoon);
        }
    }

    public componentDidMount(): void {
        VoiceRecordingStore.instance.on(UPDATE_EVENT, this.onVoiceStoreUpdate);

        window.addEventListener("beforeunload", this.saveWysiwygEditorState);
        if (this.state.isWysiwygLabEnabled) {
            const wysiwygState = this.restoreWysiwygEditorState();
            if (wysiwygState?.replyEventId) {
                dis.dispatch({
                    action: "reply_to_event",
                    event: this.props.room.findEventById(wysiwygState.replyEventId),
                    context: this.context.timelineRenderingType,
                });
            }
        }

        SettingsStore.monitorSetting("MessageComposerInput.showStickersButton", null);
        SettingsStore.monitorSetting("MessageComposerInput.showPollsButton", null);
        SettingsStore.monitorSetting("feature_wysiwyg_composer", null);

        this.dispatcherRef = dis.register(this.onAction);
        this.waitForOwnMember();
        UIStore.instance.trackElementDimensions(`MessageComposer${this.instanceId}`, this.ref.current!);
        UIStore.instance.on(`MessageComposer${this.instanceId}`, this.onResize);
        this.updateRecordingState(); // grab any cached recordings
    }

    private onResize = (type: UI_EVENTS, entry: ResizeObserverEntry): void => {
        if (type === UI_EVENTS.Resize) {
            const { narrow } = this.context;
            this.setState({
                isMenuOpen: !narrow ? false : this.state.isMenuOpen,
                isStickerPickerOpen: false,
            });
        }
    };

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "reply_to_event":
                if (payload.context === this.context.timelineRenderingType) {
                    // add a timeout for the reply preview to be rendered, so
                    // that the ScrollPanel listening to the resizeNotifier can
                    // correctly measure it's new height and scroll down to keep
                    // at the bottom if it already is
                    window.setTimeout(() => {
                        this.props.resizeNotifier.notifyTimelineHeightChanged();
                    }, 100);
                }
                break;

            case Action.SettingUpdated: {
                const settingUpdatedPayload = payload as SettingUpdatedPayload;
                switch (settingUpdatedPayload.settingName) {
                    case "MessageComposerInput.showStickersButton": {
                        const showStickersButton = SettingsStore.getValue("MessageComposerInput.showStickersButton");
                        if (this.state.showStickersButton !== showStickersButton) {
                            this.setState({ showStickersButton });
                        }
                        break;
                    }
                    case "MessageComposerInput.showPollsButton": {
                        const showPollsButton = SettingsStore.getValue("MessageComposerInput.showPollsButton");
                        if (this.state.showPollsButton !== showPollsButton) {
                            this.setState({ showPollsButton });
                        }
                        break;
                    }
                    case "feature_wysiwyg_composer": {
                        if (this.state.isWysiwygLabEnabled !== settingUpdatedPayload.newValue) {
                            this.setState({ isWysiwygLabEnabled: Boolean(settingUpdatedPayload.newValue) });
                        }
                        break;
                    }
                }
            }
        }
    };

    private waitForOwnMember(): void {
        // If we have the member already, do that
        const me = this.props.room.getMember(MatrixClientPeg.safeGet().getUserId()!);
        if (me) {
            this.setState({ me });
            return;
        }
        // Otherwise, wait for member loading to finish and then update the member for the avatar.
        // The members should already be loading, and loadMembersIfNeeded
        // will return the promise for the existing operation
        this.props.room.loadMembersIfNeeded().then(() => {
            const me = this.props.room.getMember(MatrixClientPeg.safeGet().getSafeUserId()) ?? undefined;
            this.setState({ me });
        });
    }

    public componentWillUnmount(): void {
        VoiceRecordingStore.instance.off(UPDATE_EVENT, this.onVoiceStoreUpdate);
        dis.unregister(this.dispatcherRef);
        UIStore.instance.stopTrackingElementDimensions(`MessageComposer${this.instanceId}`);
        UIStore.instance.removeListener(`MessageComposer${this.instanceId}`, this.onResize);

        window.removeEventListener("beforeunload", this.saveWysiwygEditorState);
        this.saveWysiwygEditorState();
        // clean up our listeners by setting our cached recording to falsy (see internal setter)
        this.voiceRecording = null;
    }

    private onTombstoneClick = (ev: ButtonEvent): void => {
        ev.preventDefault();

        const replacementRoomId = this.context.tombstone?.getContent()["replacement_room"];
        const replacementRoom = MatrixClientPeg.safeGet().getRoom(replacementRoomId);
        let createEventId: string | undefined;
        if (replacementRoom) {
            const createEvent = replacementRoom.currentState.getStateEvents(EventType.RoomCreate, "");
            if (createEvent?.getId()) createEventId = createEvent.getId();
        }

        const sender = this.context.tombstone?.getSender();
        const viaServers = sender ? [sender.split(":").slice(1).join(":")] : undefined;

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            highlighted: true,
            event_id: createEventId,
            room_id: replacementRoomId,
            auto_join: true,
            // Try to join via the server that sent the event. This converts @something:example.org
            // into a server domain by splitting on colons and ignoring the first entry ("@something").
            via_servers: viaServers,
            metricsTrigger: "Tombstone",
            metricsViaKeyboard: ev.type !== "click",
        });
    };

    private renderPlaceholderText = (): string => {
        if (this.props.replyToEvent) {
            const replyingToThread = this.props.relation?.rel_type === THREAD_RELATION_TYPE.name;
            if (replyingToThread && this.props.e2eStatus) {
                return _t("composer|placeholder_thread_encrypted");
            } else if (replyingToThread) {
                return _t("composer|placeholder_thread");
            } else if (this.props.e2eStatus) {
                return _t("composer|placeholder_reply_encrypted");
            } else {
                return _t("composer|placeholder_reply");
            }
        } else {
            if (this.props.e2eStatus) {
                return _t("composer|placeholder_encrypted");
            } else {
                return _t("composer|placeholder");
            }
        }
    };

    private addEmoji = (emoji: string): boolean => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            text: emoji,
            timelineRenderingType: this.context.timelineRenderingType,
        });
        return true;
    };

    private sendMessage = async (): Promise<void> => {
        if (this.state.haveRecording && this.voiceRecordingButton.current) {
            // There shouldn't be any text message to send when a voice recording is active, so
            // just send out the voice recording.
            await this.voiceRecordingButton.current?.send();
            return;
        }

        this.messageComposerInput.current?.sendMessage();

        if (this.state.isWysiwygLabEnabled) {
            const { relation, replyToEvent } = this.props;
            const composerContent = this.state.composerContent;
            this.setState({ composerContent: "", initialComposerContent: "" });
            dis.dispatch({
                action: Action.ClearAndFocusSendMessageComposer,
                timelineRenderingType: this.context.timelineRenderingType,
            });
            await sendMessage(composerContent, this.state.isRichTextEnabled, {
                mxClient: this.props.mxClient,
                roomContext: this.context,
                relation,
                replyToEvent,
            });
        }
    };

    private onChange = (model: EditorModel): void => {
        this.setState({
            isComposerEmpty: model.isEmpty,
        });
    };

    private onWysiwygChange = (content: string): void => {
        this.setState({
            composerContent: content,
            isComposerEmpty: content?.length === 0,
        });
    };

    private onRichTextToggle = async (): Promise<void> => {
        const { richToPlain, plainToRich } = await getConversionFunctions();

        const { isRichTextEnabled, composerContent } = this.state;
        const convertedContent = isRichTextEnabled
            ? await richToPlain(composerContent, false)
            : await plainToRich(composerContent, false);

        this.setState({
            isRichTextEnabled: !isRichTextEnabled,
            composerContent: convertedContent,
            initialComposerContent: convertedContent,
        });
    };

    private onVoiceStoreUpdate = (): void => {
        this.updateRecordingState();
    };

    private updateRecordingState(): void {
        const voiceRecordingId = VoiceRecordingStore.getVoiceRecordingId(this.props.room, this.props.relation);
        this.voiceRecording = VoiceRecordingStore.instance.getActiveRecording(voiceRecordingId);
        if (this.voiceRecording) {
            // If the recording has already started, it's probably a cached one.
            if (this.voiceRecording.hasRecording && !this.voiceRecording.isRecording) {
                this.setState({ haveRecording: true });
            }

            // Note: Listeners for recording states are set by the `this.voiceRecording` setter.
        } else {
            this.setState({ haveRecording: false });
        }
    }

    private onRecordingStarted = (): void => {
        // update the recording instance, just in case
        const voiceRecordingId = VoiceRecordingStore.getVoiceRecordingId(this.props.room, this.props.relation);
        this.voiceRecording = VoiceRecordingStore.instance.getActiveRecording(voiceRecordingId);
        this.setState({
            haveRecording: !!this.voiceRecording,
        });
    };

    private onRecordingEndingSoon = ({ secondsLeft }: { secondsLeft: number }): void => {
        this.setState({ recordingTimeLeftSeconds: secondsLeft });
        window.setTimeout(() => this.setState({ recordingTimeLeftSeconds: undefined }), 3000);
    };

    private setStickerPickerOpen = (isStickerPickerOpen: boolean): void => {
        this.setState({
            isStickerPickerOpen,
            isMenuOpen: false,
        });
    };

    private toggleStickerPickerOpen = (): void => {
        this.setStickerPickerOpen(!this.state.isStickerPickerOpen);
    };

    private toggleButtonMenu = (): void => {
        this.setState({
            isMenuOpen: !this.state.isMenuOpen,
        });
    };

    private get showStickersButton(): boolean {
        return this.state.showStickersButton && !isLocalRoom(this.props.room);
    }

    private getMenuPosition(): MenuProps | undefined {
        if (this.ref.current) {
            const hasFormattingButtons = this.state.isWysiwygLabEnabled && this.state.isRichTextEnabled;
            const contentRect = this.ref.current.getBoundingClientRect();
            // Here we need to remove the all the extra space above the editor
            // Instead of doing a querySelector or pass a ref to find the compute the height formatting buttons
            // We are using an arbitrary value, the formatting buttons height doesn't change during the lifecycle of the component
            // It's easier to just use a constant here instead of an over-engineering way to find the height
            const heightToRemove = hasFormattingButtons ? 36 : 0;
            const fixedRect = new DOMRect(
                contentRect.x,
                contentRect.y + heightToRemove,
                contentRect.width,
                contentRect.height - heightToRemove,
            );
            return aboveLeftOf(fixedRect);
        }
    }

    private onRecordStartEndClick = (): void => {
        this.voiceRecordingButton.current?.onRecordStartEndClick();

        if (this.context.narrow) {
            this.toggleButtonMenu();
        }
    };

    public render(): React.ReactNode {
        const hasE2EIcon = Boolean(!this.state.isWysiwygLabEnabled && this.props.e2eStatus);
        const e2eIcon = hasE2EIcon && (
            <div className="mx_MessageComposer_e2eIconWrapper">
                <E2EIcon key="e2eIcon" status={this.props.e2eStatus!} className="mx_MessageComposer_e2eIcon" />
            </div>
        );

        const controls: ReactNode[] = [];
        const menuPosition = this.getMenuPosition();

        const canSendMessages = this.context.canSendMessages && !this.context.tombstone;
        let composer: ReactNode;
        if (canSendMessages) {
            if (this.state.isWysiwygLabEnabled && menuPosition) {
                composer = (
                    <SendWysiwygComposer
                        key="controls_input"
                        disabled={this.state.haveRecording}
                        onChange={this.onWysiwygChange}
                        onSend={this.sendMessage}
                        isRichTextEnabled={this.state.isRichTextEnabled}
                        initialContent={this.state.initialComposerContent}
                        e2eStatus={this.props.e2eStatus}
                        menuPosition={menuPosition}
                        placeholder={this.renderPlaceholderText()}
                        eventRelation={this.props.relation}
                    />
                );
            } else {
                composer = (
                    <SendMessageComposer
                        ref={this.messageComposerInput}
                        key="controls_input"
                        room={this.props.room}
                        placeholder={this.renderPlaceholderText()}
                        relation={this.props.relation}
                        replyToEvent={this.props.replyToEvent}
                        onChange={this.onChange}
                        disabled={this.state.haveRecording}
                        toggleStickerPickerOpen={this.toggleStickerPickerOpen}
                    />
                );
            }

            controls.push(
                <VoiceRecordComposerTile
                    key="controls_voice_record"
                    ref={this.voiceRecordingButton}
                    room={this.props.room}
                    relation={this.props.relation}
                    replyToEvent={this.props.replyToEvent}
                />,
            );
        } else if (this.context.tombstone) {
            const replacementRoomId = this.context.tombstone.getContent()["replacement_room"];

            const continuesLink = replacementRoomId ? (
                <a
                    href={makeRoomPermalink(MatrixClientPeg.safeGet(), replacementRoomId)}
                    className="mx_MessageComposer_roomReplaced_link"
                    onClick={this.onTombstoneClick}
                >
                    {_t("composer|room_upgraded_link")}
                </a>
            ) : (
                ""
            );

            controls.push(
                <div className="mx_MessageComposer_replaced_wrapper" key="room_replaced">
                    <div className="mx_MessageComposer_replaced_valign">
                        <img
                            aria-hidden
                            alt=""
                            className="mx_MessageComposer_roomReplaced_icon"
                            src={RoomReplacedSvg}
                        />
                        <span className="mx_MessageComposer_roomReplaced_header">
                            {_t("composer|room_upgraded_notice")}
                        </span>
                        <br />
                        {continuesLink}
                    </div>
                </div>,
            );
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    {_t("composer|no_perms_notice")}
                </div>,
            );
        }

        const isTooltipOpen = Boolean(this.state.recordingTimeLeftSeconds);
        const secondsLeft = this.state.recordingTimeLeftSeconds ? Math.round(this.state.recordingTimeLeftSeconds) : 0;

        const threadId =
            this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation.event_id : null;

        controls.push(
            <Stickerpicker
                room={this.props.room}
                threadId={threadId}
                isStickerPickerOpen={this.state.isStickerPickerOpen}
                setStickerPickerOpen={this.setStickerPickerOpen}
                menuPosition={menuPosition}
                key="stickers"
            />,
        );

        const showSendButton = canSendMessages && (!this.state.isComposerEmpty || this.state.haveRecording);

        const classes = classNames({
            "mx_MessageComposer": true,
            "mx_MessageComposer--compact": this.props.compact,
            "mx_MessageComposer_e2eStatus": hasE2EIcon,
            "mx_MessageComposer_wysiwyg": this.state.isWysiwygLabEnabled,
        });

        return (
            <Tooltip open={isTooltipOpen} description={formatTimeLeft(secondsLeft)} placement="bottom">
                <div className={classes} ref={this.ref} role="region" aria-label={_t("a11y|message_composer")}>
                    <div className="mx_MessageComposer_wrapper">
                        <UserIdentityWarning room={this.props.room} key={this.props.room.roomId} />
                        <ReplyPreview
                            replyToEvent={this.props.replyToEvent}
                            permalinkCreator={this.props.permalinkCreator}
                        />
                        <div className="mx_MessageComposer_row">
                            {e2eIcon}
                            {composer}
                            <div className="mx_MessageComposer_actions">
                                {controls}
                                {canSendMessages && (
                                    <MessageComposerButtons
                                        addEmoji={this.addEmoji}
                                        haveRecording={this.state.haveRecording}
                                        isMenuOpen={this.state.isMenuOpen}
                                        isStickerPickerOpen={this.state.isStickerPickerOpen}
                                        menuPosition={menuPosition}
                                        relation={this.props.relation}
                                        onRecordStartEndClick={this.onRecordStartEndClick}
                                        setStickerPickerOpen={this.setStickerPickerOpen}
                                        showLocationButton={
                                            !window.electron && SettingsStore.getValue(UIFeature.LocationSharing)
                                        }
                                        showPollsButton={this.state.showPollsButton}
                                        showStickersButton={this.showStickersButton}
                                        isRichTextEnabled={this.state.isRichTextEnabled}
                                        onComposerModeClick={this.onRichTextToggle}
                                        toggleButtonMenu={this.toggleButtonMenu}
                                    />
                                )}
                                {showSendButton && (
                                    <SendButton
                                        key="controls_send"
                                        onClick={this.sendMessage}
                                        title={
                                            this.state.haveRecording
                                                ? _t("composer|send_button_voice_message")
                                                : undefined
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Tooltip>
        );
    }
}

const MessageComposerWithMatrixClient = withMatrixClientHOC(MessageComposer);
export default MessageComposerWithMatrixClient;
