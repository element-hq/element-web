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
    ActionBarAction,
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
import { type SettingKey } from "../../settings/Settings";
import { getMediaVisibility, setMediaVisibility } from "../../utils/media/mediaVisibility";
import { FileDownloader } from "../../utils/FileDownloader";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import { ModuleApi } from "../../modules/Api";

export interface EventTileActionBarViewModelProps {
    mxEvent: MatrixEvent;
    timelineRenderingType: TimelineRenderingType;
    canSendMessages: boolean;
    canReact: boolean;
    isSearch?: boolean;
    isCard?: boolean;
    isQuoteExpanded?: boolean;
    onOptionsClick?: (anchor: HTMLElement | null) => void;
    onReactionsClick?: (anchor: HTMLElement | null) => void;
    getRelationsForEvent?: GetRelationsForEvent;
    onToggleThreadExpanded?: (anchor: HTMLElement | null) => void;
}

interface LocalActionBarState {
    canDownload: boolean;
    isDownloadLoading: boolean;
}

interface DerivedEventState {
    showCancel: boolean;
    showEdit: boolean;
    showPinOrUnpin: boolean;
    showReact: boolean;
    showReply: boolean;
    showExpandCollapse: boolean;
    showReplyInThread: boolean;
    showThreadForDeletedMessage: boolean;
    isFailed: boolean;
    isPinned: boolean;
    isQuoteExpanded: boolean;
    isThreadReplyAllowed: boolean;
}

interface DerivedMediaState {
    showHide: boolean;
    showDownload: boolean;
    isDownloadEncrypted: boolean;
    isDownloadLoading: boolean;
}

export class EventTileActionBarViewModel
    extends BaseViewModel<ActionBarViewSnapshot, EventTileActionBarViewModelProps>
    implements ActionBarViewActions
{
    private listenerCleanups: Array<() => void> = [];
    private downloadPermissionRequestId = 0;
    private downloadRequestId = 0;
    private canDownload = true;
    private isDownloadLoading = false;
    private readonly downloader = new FileDownloader();
    private downloadedBlob?: Blob;

    public constructor(props: EventTileActionBarViewModelProps) {
        super(
            props,
            EventTileActionBarViewModel.buildSnapshot(props, {
                canDownload: true,
                isDownloadLoading: false,
            }),
        );
        this.setupListeners();
    }

    private static buildSnapshot(
        props: EventTileActionBarViewModelProps,
        localState: LocalActionBarState,
    ): ActionBarViewSnapshot {
        const client = MatrixClientPeg.safeGet();
        const eventState = EventTileActionBarViewModel.getDerivedEventState(props, client);
        const mediaState = EventTileActionBarViewModel.getDerivedMediaState(props.mxEvent, client, localState);

        return {
            actions: EventTileActionBarViewModel.resolveActions(eventState, mediaState),
            presentation: "icon",
            isDownloadEncrypted: mediaState.isDownloadEncrypted,
            isDownloadLoading: mediaState.isDownloadLoading,
            isPinned: eventState.isPinned,
            isQuoteExpanded: eventState.isQuoteExpanded,
            isThreadReplyAllowed: eventState.isThreadReplyAllowed,
        };
    }

    private static resolveActions(eventState: DerivedEventState, mediaState: DerivedMediaState): ActionBarAction[] {
        const actions: ActionBarAction[] = [];

        if (eventState.showCancel && eventState.isFailed) {
            return [ActionBarAction.Resend, ActionBarAction.Cancel];
        }

        if (mediaState.showHide) {
            actions.push(ActionBarAction.Hide);
        }
        if (mediaState.showDownload) {
            actions.push(ActionBarAction.Download);
        }
        if (eventState.showReact) {
            actions.push(ActionBarAction.React);
        }
        if (!eventState.showReply && eventState.showThreadForDeletedMessage) {
            actions.push(ActionBarAction.ReplyInThread);
        }
        if (eventState.showReply) {
            actions.push(ActionBarAction.Reply);
        }
        if (eventState.showReply && eventState.showReplyInThread) {
            actions.push(ActionBarAction.ReplyInThread);
        }
        if (eventState.showEdit) {
            actions.push(ActionBarAction.Edit);
        }
        if (eventState.showPinOrUnpin) {
            actions.push(ActionBarAction.Pin);
        }
        if (eventState.showCancel) {
            actions.push(ActionBarAction.Cancel);
        }
        if (eventState.showExpandCollapse) {
            actions.push(ActionBarAction.Expand);
        }

        actions.push(ActionBarAction.Options);

        return actions;
    }

    private static getDerivedEventState(
        props: EventTileActionBarViewModelProps,
        client: ReturnType<typeof MatrixClientPeg.safeGet>,
    ): DerivedEventState {
        const { mxEvent } = props;
        const contentActionable = isContentActionable(mxEvent);
        const editStatus = mxEvent.replacingEvent()?.status;
        const redactStatus = mxEvent.localRedactionEvent()?.status;
        const relationType = mxEvent.getRelation()?.rel_type;

        return {
            showCancel: canCancel(mxEvent.status) || canCancel(editStatus) || canCancel(redactStatus),
            showEdit: canEditContent(client, mxEvent),
            showPinOrUnpin: PinningUtils.canPin(client, mxEvent) || PinningUtils.canUnpin(client, mxEvent),
            showReact: contentActionable && props.canReact && !props.isSearch,
            showReply: contentActionable && props.canSendMessages,
            isThreadReplyAllowed: !(!!relationType && relationType !== RelationType.Thread),
            showExpandCollapse: props.isQuoteExpanded !== undefined && shouldDisplayReply(mxEvent),
            showReplyInThread: contentActionable && EventTileActionBarViewModel.canShowReplyInThreadAction(props),
            showThreadForDeletedMessage:
                !contentActionable &&
                props.timelineRenderingType === TimelineRenderingType.Room &&
                Boolean(mxEvent.getThread()),
            isFailed: [mxEvent.status, editStatus, redactStatus].includes(EventStatus.NOT_SENT),
            isPinned: PinningUtils.isPinned(client, mxEvent),
            isQuoteExpanded: props.isQuoteExpanded ?? false,
        };
    }

    private static getDerivedMediaState(
        mxEvent: MatrixEvent,
        client: ReturnType<typeof MatrixClientPeg.safeGet>,
        localState: LocalActionBarState,
    ): DerivedMediaState {
        const contentActionable = isContentActionable(mxEvent);
        const mediaHelper = MediaEventHelper.isEligible(mxEvent) ? new MediaEventHelper(mxEvent) : undefined;

        return {
            showDownload: contentActionable && Boolean(mediaHelper) && localState.canDownload,
            showHide: contentActionable && MediaEventHelper.canHide(mxEvent) && getMediaVisibility(mxEvent, client),
            isDownloadEncrypted: mediaHelper?.media.isEncrypted ?? false,
            isDownloadLoading: localState.isDownloadLoading,
        };
    }

    private computeSnapshot(): ActionBarViewSnapshot {
        return EventTileActionBarViewModel.buildSnapshot(this.props, {
            canDownload: this.canDownload,
            isDownloadLoading: this.isDownloadLoading,
        });
    }

    private static canShowReplyInThreadAction(props: EventTileActionBarViewModelProps): boolean {
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
        this.watchSetting("mediaPreviewConfig", roomId ?? null);
        this.watchSetting("showMediaEventIds", null);

        const roomState = roomId
            ? MatrixClientPeg.safeGet().getRoom(roomId)?.getLiveTimeline().getState(EventTimeline.FORWARDS)
            : undefined;
        if (roomState) {
            roomState.on(RoomStateEvent.Events, this.onRoomEvent);
            this.addListenerCleanup(() => roomState.off(RoomStateEvent.Events, this.onRoomEvent));
        }

        MatrixClientPeg.safeGet().decryptEventIfNeeded(mxEvent);
        void this.updateDownloadPermission(++this.downloadPermissionRequestId);
    }

    private teardownListeners(): void {
        for (const cleanup of this.listenerCleanups) {
            cleanup();
        }
        this.listenerCleanups = [];
    }

    private addListenerCleanup(cleanup: () => void): void {
        this.listenerCleanups.push(cleanup);
    }

    private trackEvent(event: MatrixEvent, eventName: MatrixEventEvent, callback: (...args: unknown[]) => void): void {
        event.on(eventName, callback);
        this.addListenerCleanup(() => event.off(eventName, callback));
    }

    private watchSetting(settingName: SettingKey, roomId: string | null): void {
        const watcherRef = SettingsStore.watchSetting(settingName, roomId, this.refreshSnapshot);
        this.addListenerCleanup(() => SettingsStore.unwatchSetting(watcherRef));
    }

    private readonly refreshSnapshot = (): void => {
        this.snapshot.set(this.computeSnapshot());
    };

    private resetEventState(): void {
        this.downloadedBlob = undefined;
        this.canDownload = true;
        this.isDownloadLoading = false;
    }

    private isCurrentDownloadPermissionRequest(requestId: number, mxEvent: MatrixEvent): boolean {
        return !this.isDisposed && requestId === this.downloadPermissionRequestId && this.props.mxEvent === mxEvent;
    }

    private updateDownloadPermissionState(requestId: number, mxEvent: MatrixEvent, canDownload: boolean): boolean {
        if (!this.isCurrentDownloadPermissionRequest(requestId, mxEvent)) return false;
        this.canDownload = canDownload;
        this.refreshSnapshot();
        return true;
    }

    private async updateDownloadPermission(requestId: number): Promise<void> {
        const { mxEvent } = this.props;
        const hints = ModuleApi.instance.customComponents.getHintsForMessage(mxEvent);

        if (!hints?.allowDownloadingMedia) {
            this.updateDownloadPermissionState(requestId, mxEvent, true);
            return;
        }

        if (!this.updateDownloadPermissionState(requestId, mxEvent, false)) return;

        try {
            const canDownload = await hints.allowDownloadingMedia();
            this.updateDownloadPermissionState(requestId, mxEvent, canDownload);
        } catch (err) {
            logger.error(`Failed to check media download permission for ${mxEvent.getId()}`, err);
            this.updateDownloadPermissionState(requestId, mxEvent, false);
        }
    }

    private isCurrentDownloadRequest(requestId: number, mxEvent: MatrixEvent): boolean {
        return !this.isDisposed && requestId === this.downloadRequestId && this.props.mxEvent === mxEvent;
    }

    private setDownloadLoading(requestId: number, mxEvent: MatrixEvent, isDownloadLoading: boolean): boolean {
        if (!this.isCurrentDownloadRequest(requestId, mxEvent)) return false;
        this.isDownloadLoading = isDownloadLoading;
        this.refreshSnapshot();
        return true;
    }

    private readonly onRoomEvent = (event?: MatrixEvent): void => {
        if (!event) return;
        if (event.getType() !== EventType.RoomPinnedEvents && event.getType() !== EventType.RoomJoinRules) return;
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

    public setProps(newProps: Partial<EventTileActionBarViewModelProps>): void {
        const prevEvent = this.props.mxEvent;
        const prevRoomId = prevEvent.getRoomId();

        this.props = {
            ...this.props,
            ...newProps,
        };

        if (this.props.mxEvent !== prevEvent || this.props.mxEvent.getRoomId() !== prevRoomId) {
            this.resetEventState();
            this.setupListeners();
        }

        this.refreshSnapshot();
    }

    public override dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    public onReplyClick = (_anchor: HTMLElement | null): void => {
        defaultDispatcher.dispatch({
            action: "reply_to_event",
            event: this.props.mxEvent,
            context: this.props.timelineRenderingType,
        });
    };

    public onEditClick = (_anchor: HTMLElement | null): void => {
        editEvent(
            MatrixClientPeg.safeGet(),
            this.props.mxEvent,
            this.props.timelineRenderingType,
            this.props.getRelationsForEvent,
        );
    };

    public onResendClick = (_anchor: HTMLElement | null): void => {
        this.runActionOnFailedEv((event) => Resend.resend(MatrixClientPeg.safeGet(), event));
    };

    public onCancelClick = (_anchor: HTMLElement | null): void => {
        this.runActionOnFailedEv(
            (event) => Resend.removeFromQueue(MatrixClientPeg.safeGet(), event),
            (event) => canCancel(event.status),
        );
    };

    public onPinClick = async (_anchor: HTMLElement | null): Promise<void> => {
        const isPinned = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
        await PinningUtils.pinOrUnpinEvent(MatrixClientPeg.safeGet(), this.props.mxEvent);
        PosthogTrackers.trackPinUnpinMessage(isPinned ? "Pin" : "Unpin", "Timeline");
    };

    public onDownloadClick = async (_anchor: HTMLElement | null): Promise<void> => {
        if (this.isDownloadLoading || !this.canDownload) return;
        const requestId = ++this.downloadRequestId;
        const { mxEvent } = this.props;

        try {
            if (!this.setDownloadLoading(requestId, mxEvent, true)) return;
            const mediaEventHelper = new MediaEventHelper(mxEvent);

            if (!this.downloadedBlob) {
                const downloadedBlob = await mediaEventHelper.sourceBlob.value;
                if (!this.isCurrentDownloadRequest(requestId, mxEvent)) return;
                this.downloadedBlob = downloadedBlob;
            }

            await this.downloader.download({
                blob: this.downloadedBlob,
                name: mediaEventHelper.fileName ?? _t("common|image"),
            });
        } catch (e) {
            if (!this.isCurrentDownloadRequest(requestId, mxEvent)) return;
            Modal.createDialog(ErrorDialog, {
                title: _t("timeline|download_failed"),
                description: `${_t("timeline|download_failed_description")}\n\n${String(e)}`,
            });
        } finally {
            this.setDownloadLoading(requestId, mxEvent, false);
        }
    };

    public onHideClick = (_anchor: HTMLElement | null): void => {
        void setMediaVisibility(this.props.mxEvent, false);
    };

    public onToggleThreadExpanded = (anchor: HTMLElement | null): void => {
        this.props.onToggleThreadExpanded?.(anchor);
    };

    public onOptionsClick = (anchor: HTMLElement | null): void => {
        this.props.onOptionsClick?.(anchor);
    };

    public onReactionsClick = (anchor: HTMLElement | null): void => {
        this.props.onReactionsClick?.(anchor);
    };

    public onReplyInThreadClick = (_anchor: HTMLElement | null): void => {
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
