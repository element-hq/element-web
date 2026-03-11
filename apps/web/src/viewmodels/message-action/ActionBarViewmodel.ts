/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    EventStatus,
    EventTimeline,
    EventType,
    MatrixEventEvent,
    M_BEACON_INFO,
    MsgType,
    RelationType,
    RoomStateEvent,
    type MatrixEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type ActionBarViewActions,
    type ActionBarViewSnapshot,
} from "@element-hq/web-shared-components";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ShowThreadPayload } from "../../dispatcher/payloads/ShowThreadPayload";
import { type GetRelationsForEvent } from "../../components/views/rooms/EventTile";
import { canCancel, canEditContent, editEvent, isContentActionable } from "../../utils/EventUtils";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import Resend from "../../Resend";
import PinningUtils from "../../utils/PinningUtils";
import PosthogTrackers from "../../PosthogTrackers";
import { shouldDisplayReply } from "../../utils/Reply";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import SettingsStore from "../../settings/SettingsStore";
import { getMediaVisibility, setMediaVisibility } from "../../utils/media/mediaVisibility";
import { FileDownloader } from "../../utils/FileDownloader";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import { ModuleApi } from "../../modules/Api";

export interface ActionBarViewModelProps {
    mxEvent: MatrixEvent;
    timelineRenderingType: TimelineRenderingType;
    canSendMessages: boolean;
    canReact: boolean;
    isSearch?: boolean;
    isCard?: boolean;
    isQuoteExpanded?: boolean;
    getRelationsForEvent?: GetRelationsForEvent;
    onReactClick?: ActionBarViewActions["onReactClick"];
    onOptionsClick?: ActionBarViewActions["onOptionsClick"];
    onToggleThreadExpanded?: ActionBarViewActions["onToggleThreadExpanded"];
}

export class ActionBarViewModel
    extends BaseViewModel<ActionBarViewSnapshot, ActionBarViewModelProps>
    implements ActionBarViewActions
{
    private eventUnsubscribers: Array<() => void> = [];
    private roomStateUnsubscriber?: () => void;
    private mediaPreviewWatcherRef?: string;
    private mediaVisibilityWatcherRef?: string;
    private canDownload = true;
    private isDownloadLoading = false;
    private readonly downloader = new FileDownloader();
    private downloadedBlob?: Blob;

    public constructor(props: ActionBarViewModelProps) {
        super(props, ActionBarViewModel.initialSnapshot(props));
        this.setupListeners();
    }

    private static initialSnapshot(props: ActionBarViewModelProps): ActionBarViewSnapshot {
        const client = MatrixClientPeg.safeGet();
        const { mxEvent } = props;

        return {
            align: "end",
            side: "top",
            canCancel: false,
            canEdit: canEditContent(client, mxEvent),
            canPinOrUnpin: PinningUtils.canPin(client, mxEvent) || PinningUtils.canUnpin(client, mxEvent),
            canReact: props.canReact && !props.isSearch,
            canSendMessages: props.canSendMessages,
            showDownloadAction: false,
            showExpandCollapseAction: props.isQuoteExpanded !== undefined && shouldDisplayReply(mxEvent),
            showHideAction: MediaEventHelper.canHide(mxEvent) && getMediaVisibility(mxEvent, client),
            showReplyInThreadAction: ActionBarViewModel.canShowReplyInThreadAction(props),
            showThreadForDeletedMessage:
                props.timelineRenderingType === TimelineRenderingType.Room && Boolean(mxEvent.getThread()),
            canStartThread: !(
                !!mxEvent.getRelation()?.rel_type && mxEvent.getRelation()?.rel_type !== RelationType.Thread
            ),
            isContentActionable: isContentActionable(mxEvent),
            isDownloadEncrypted: MediaEventHelper.isEligible(mxEvent)
                ? new MediaEventHelper(mxEvent).media.isEncrypted
                : false,
            isDownloadLoading: false,
            isFailed: false,
            isPinned: PinningUtils.isPinned(client, mxEvent),
            isQuoteExpanded: props.isQuoteExpanded ?? false,
        };
    }

    private computeSnapshot(): ActionBarViewSnapshot {
        const client = MatrixClientPeg.safeGet();
        const { mxEvent } = this.props;
        const editStatus = mxEvent.replacingEvent()?.status;
        const redactStatus = mxEvent.localRedactionEvent()?.status;
        const canCancelPending = canCancel(mxEvent.status) || canCancel(editStatus) || canCancel(redactStatus);
        const isFailed = [mxEvent.status, editStatus, redactStatus].includes(EventStatus.NOT_SENT);
        const relationType = mxEvent.getRelation()?.rel_type;
        const canStartThread = !(!!relationType && relationType !== RelationType.Thread);
        const mediaIsVisible = getMediaVisibility(mxEvent, client);

        return {
            align: "end",
            side: "top",
            canCancel: canCancelPending,
            canEdit: canEditContent(client, mxEvent),
            canPinOrUnpin: PinningUtils.canPin(client, mxEvent) || PinningUtils.canUnpin(client, mxEvent),
            canReact: this.props.canReact && !this.props.isSearch,
            canSendMessages: this.props.canSendMessages,
            showDownloadAction: MediaEventHelper.isEligible(mxEvent) && this.canDownload,
            showExpandCollapseAction: this.props.isQuoteExpanded !== undefined && shouldDisplayReply(mxEvent),
            showHideAction: MediaEventHelper.canHide(mxEvent) && mediaIsVisible,
            showReplyInThreadAction: ActionBarViewModel.canShowReplyInThreadAction(this.props),
            showThreadForDeletedMessage:
                this.props.timelineRenderingType === TimelineRenderingType.Room && Boolean(mxEvent.getThread()),
            canStartThread: canStartThread,
            isContentActionable: isContentActionable(mxEvent),
            isDownloadEncrypted: MediaEventHelper.isEligible(mxEvent)
                ? new MediaEventHelper(mxEvent).media.isEncrypted
                : false,
            isDownloadLoading: this.isDownloadLoading,
            isFailed,
            isPinned: PinningUtils.isPinned(client, mxEvent),
            isQuoteExpanded: this.props.isQuoteExpanded ?? false,
        };
    }

    private static canShowReplyInThreadAction(props: ActionBarViewModelProps): boolean {
        const inNotThreadTimeline = props.timelineRenderingType !== TimelineRenderingType.Thread;
        const content = props.mxEvent.getContent();
        const isAllowedMessageType =
            ![MsgType.KeyVerificationRequest].includes(content.msgtype as MsgType) &&
            !M_BEACON_INFO.matches(props.mxEvent.getType());

        return inNotThreadTimeline && isAllowedMessageType;
    }

    private setupListeners(): void {
        this.teardownListeners();

        const { mxEvent } = this.props;
        const roomId = mxEvent.getRoomId();
        this.trackEvent(mxEvent, MatrixEventEvent.Status, this.refreshSnapshot);
        this.trackEvent(mxEvent, MatrixEventEvent.Decrypted, this.refreshSnapshot);
        this.trackEvent(mxEvent, MatrixEventEvent.BeforeRedaction, this.refreshSnapshot);
        this.mediaPreviewWatcherRef = SettingsStore.watchSetting(
            "mediaPreviewConfig",
            roomId ?? null,
            this.refreshSnapshot,
        );
        this.mediaVisibilityWatcherRef = SettingsStore.watchSetting("showMediaEventIds", null, this.refreshSnapshot);

        const roomState = roomId
            ? MatrixClientPeg.safeGet().getRoom(roomId)?.getLiveTimeline().getState(EventTimeline.FORWARDS)
            : undefined;
        if (roomState) {
            roomState.on(RoomStateEvent.Events, this.onRoomEvent);
            this.roomStateUnsubscriber = () => roomState.off(RoomStateEvent.Events, this.onRoomEvent);
        }

        MatrixClientPeg.safeGet().decryptEventIfNeeded(mxEvent);
        void this.updateDownloadPermission();
    }

    private teardownListeners(): void {
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];
        this.roomStateUnsubscriber?.();
        this.roomStateUnsubscriber = undefined;
        SettingsStore.unwatchSetting(this.mediaPreviewWatcherRef);
        SettingsStore.unwatchSetting(this.mediaVisibilityWatcherRef);
        this.mediaPreviewWatcherRef = undefined;
        this.mediaVisibilityWatcherRef = undefined;
    }

    private trackEvent(event: MatrixEvent, eventName: MatrixEventEvent, callback: (...args: unknown[]) => void): void {
        event.on(eventName, callback);
        this.eventUnsubscribers.push(() => event.off(eventName, callback));
    }

    private readonly refreshSnapshot = (): void => {
        this.snapshot.set(this.computeSnapshot());
    };

    private async updateDownloadPermission(): Promise<void> {
        const { mxEvent } = this.props;
        const hints = ModuleApi.instance.customComponents.getHintsForMessage(mxEvent);

        if (!hints?.allowDownloadingMedia) {
            this.canDownload = true;
            this.refreshSnapshot();
            return;
        }

        this.canDownload = false;
        this.refreshSnapshot();

        try {
            this.canDownload = await hints.allowDownloadingMedia();
        } catch (err) {
            logger.error(`Failed to check media download permission for ${mxEvent.getId()}`, err);
            this.canDownload = false;
        }

        this.refreshSnapshot();
    }

    private readonly onRoomEvent = (event?: MatrixEvent): void => {
        if (!event || event.getType() !== EventType.RoomPinnedEvents) return;
        this.refreshSnapshot();
    };

    /**
     * Runs an action against the failed event variant that is still actionable.
     */
    private runActionOnFailedEv(fn: (ev: MatrixEvent) => void, checkFn?: (ev: MatrixEvent) => boolean): void {
        const shouldUseEvent = checkFn ?? (() => true);
        const { mxEvent } = this.props;
        const tryOrder = [mxEvent.localRedactionEvent(), mxEvent.replacingEvent(), mxEvent];

        for (const event of tryOrder) {
            if (event && shouldUseEvent(event)) {
                fn(event);
                break;
            }
        }
    }

    public setProps(newProps: Partial<ActionBarViewModelProps>): void {
        const prevEvent = this.props.mxEvent;
        const prevRoomId = prevEvent.getRoomId();

        this.props = {
            ...this.props,
            ...newProps,
        };

        if (this.props.mxEvent !== prevEvent || this.props.mxEvent.getRoomId() !== prevRoomId) {
            this.downloadedBlob = undefined;
            this.canDownload = true;
            this.isDownloadLoading = false;
            this.setupListeners();
        }

        this.refreshSnapshot();
    }

    public override dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    public onReplyClick = (): void => {
        defaultDispatcher.dispatch({
            action: "reply_to_event",
            event: this.props.mxEvent,
            context: this.props.timelineRenderingType,
        });
    };

    public onEditClick = (): void => {
        editEvent(
            MatrixClientPeg.safeGet(),
            this.props.mxEvent,
            this.props.timelineRenderingType,
            this.props.getRelationsForEvent,
        );
    };

    public onResendClick = (): void => {
        this.runActionOnFailedEv((event) => Resend.resend(MatrixClientPeg.safeGet(), event));
    };

    public onCancelClick = (): void => {
        this.runActionOnFailedEv(
            (event) => Resend.removeFromQueue(MatrixClientPeg.safeGet(), event),
            (event) => canCancel(event.status),
        );
    };

    public onPinClick = async (): Promise<void> => {
        const isPinned = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
        await PinningUtils.pinOrUnpinEvent(MatrixClientPeg.safeGet(), this.props.mxEvent);
        PosthogTrackers.trackPinUnpinMessage(isPinned ? "Pin" : "Unpin", "Timeline");
    };

    public onReactClick = (): void => {
        this.props.onReactClick?.();
    };

    public onOptionsClick = (): void => {
        this.props.onOptionsClick?.();
    };

    public onDownloadClick = async (): Promise<void> => {
        if (this.isDownloadLoading || !this.canDownload) return;

        try {
            this.isDownloadLoading = true;
            this.refreshSnapshot();
            const mediaEventHelper = new MediaEventHelper(this.props.mxEvent);

            if (!this.downloadedBlob) {
                this.downloadedBlob = await mediaEventHelper.sourceBlob.value;
            }

            await this.downloader.download({
                blob: this.downloadedBlob,
                name: mediaEventHelper.fileName ?? _t("common|image"),
            });
        } catch (e) {
            Modal.createDialog(ErrorDialog, {
                title: _t("timeline|download_failed"),
                description: `${_t("timeline|download_failed_description")}\n\n${String(e)}`,
            });
        } finally {
            this.isDownloadLoading = false;
            this.refreshSnapshot();
        }
    };

    public onHideClick = (): void => {
        void setMediaVisibility(this.props.mxEvent, false);
    };

    public onToggleThreadExpanded = (): void => {
        this.props.onToggleThreadExpanded?.();
    };

    public onReplyInThreadClick = (): void => {
        const { mxEvent, isCard } = this.props;
        const thread = mxEvent.getThread();

        if (thread?.rootEvent && !mxEvent.isThreadRoot) {
            defaultDispatcher.dispatch<ShowThreadPayload>({
                action: Action.ShowThread,
                rootEvent: thread.rootEvent,
                initialEvent: mxEvent,
                scroll_into_view: true,
                highlighted: true,
                push: isCard,
            });
            return;
        }

        defaultDispatcher.dispatch<ShowThreadPayload>({
            action: Action.ShowThread,
            rootEvent: mxEvent,
            push: isCard,
        });
    };
}

export default ActionBarViewModel;
