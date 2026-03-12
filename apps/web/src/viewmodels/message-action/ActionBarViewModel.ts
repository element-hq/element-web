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
import { type SettingKey } from "../../settings/Settings";
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
    onOptionsClick?: (anchor: HTMLDivElement | null) => void;
    onReactionsClick?: (anchor: HTMLDivElement | null) => void;
    getRelationsForEvent?: GetRelationsForEvent;
    onToggleThreadExpanded?: (anchor: HTMLDivElement | null) => void;
}

interface LocalActionBarState {
    canDownload: boolean;
    isDownloadLoading: boolean;
}

interface DerivedEventState {
    canCancel: boolean;
    canEdit: boolean;
    canPinOrUnpin: boolean;
    canReact: boolean;
    canSendMessages: boolean;
    canStartThread: boolean;
    showExpandCollapseAction: boolean;
    showReplyInThreadAction: boolean;
    showThreadForDeletedMessage: boolean;
    isContentActionable: boolean;
    isFailed: boolean;
    isPinned: boolean;
    isQuoteExpanded: boolean;
}

interface DerivedMediaState {
    showDownloadAction: boolean;
    showHideAction: boolean;
    isDownloadEncrypted: boolean;
    isDownloadLoading: boolean;
}

export class ActionBarViewModel
    extends BaseViewModel<ActionBarViewSnapshot, ActionBarViewModelProps>
    implements ActionBarViewActions
{
    private listenerCleanups: Array<() => void> = [];
    private canDownload = true;
    private isDownloadLoading = false;
    private readonly downloader = new FileDownloader();
    private downloadedBlob?: Blob;

    public constructor(props: ActionBarViewModelProps) {
        super(
            props,
            ActionBarViewModel.buildSnapshot(props, {
                canDownload: true,
                isDownloadLoading: false,
            }),
        );
        this.setupListeners();
    }

    private static buildSnapshot(
        props: ActionBarViewModelProps,
        localState: LocalActionBarState,
    ): ActionBarViewSnapshot {
        const client = MatrixClientPeg.safeGet();
        const eventState = ActionBarViewModel.getDerivedEventState(props, client);
        const mediaState = ActionBarViewModel.getDerivedMediaState(props.mxEvent, client, localState);

        return {
            align: "end",
            side: "top",
            ...eventState,
            ...mediaState,
        };
    }

    private static getDerivedEventState(
        props: ActionBarViewModelProps,
        client: ReturnType<typeof MatrixClientPeg.safeGet>,
    ): DerivedEventState {
        const { mxEvent } = props;
        const editStatus = mxEvent.replacingEvent()?.status;
        const redactStatus = mxEvent.localRedactionEvent()?.status;
        const relationType = mxEvent.getRelation()?.rel_type;

        return {
            canCancel: canCancel(mxEvent.status) || canCancel(editStatus) || canCancel(redactStatus),
            canEdit: canEditContent(client, mxEvent),
            canPinOrUnpin: PinningUtils.canPin(client, mxEvent) || PinningUtils.canUnpin(client, mxEvent),
            canReact: props.canReact && !props.isSearch,
            canSendMessages: props.canSendMessages,
            canStartThread: !(!!relationType && relationType !== RelationType.Thread),
            showExpandCollapseAction: props.isQuoteExpanded !== undefined && shouldDisplayReply(mxEvent),
            showReplyInThreadAction: ActionBarViewModel.canShowReplyInThreadAction(props),
            showThreadForDeletedMessage:
                props.timelineRenderingType === TimelineRenderingType.Room && Boolean(mxEvent.getThread()),
            isContentActionable: isContentActionable(mxEvent),
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
        const mediaHelper = MediaEventHelper.isEligible(mxEvent) ? new MediaEventHelper(mxEvent) : undefined;

        return {
            showDownloadAction: Boolean(mediaHelper) && localState.canDownload,
            showHideAction: MediaEventHelper.canHide(mxEvent) && getMediaVisibility(mxEvent, client),
            isDownloadEncrypted: mediaHelper?.media.isEncrypted ?? false,
            isDownloadLoading: localState.isDownloadLoading,
        };
    }

    private computeSnapshot(): ActionBarViewSnapshot {
        return ActionBarViewModel.buildSnapshot(this.props, {
            canDownload: this.canDownload,
            isDownloadLoading: this.isDownloadLoading,
        });
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
        void this.updateDownloadPermission();
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
            this.resetEventState();
            this.setupListeners();
        }

        this.refreshSnapshot();
    }

    public override dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    public onReplyClick = (_anchor: HTMLDivElement | null): void => {
        defaultDispatcher.dispatch({
            action: "reply_to_event",
            event: this.props.mxEvent,
            context: this.props.timelineRenderingType,
        });
    };

    public onEditClick = (_anchor: HTMLDivElement | null): void => {
        editEvent(
            MatrixClientPeg.safeGet(),
            this.props.mxEvent,
            this.props.timelineRenderingType,
            this.props.getRelationsForEvent,
        );
    };

    public onResendClick = (_anchor: HTMLDivElement | null): void => {
        this.runActionOnFailedEv((event) => Resend.resend(MatrixClientPeg.safeGet(), event));
    };

    public onCancelClick = (_anchor: HTMLDivElement | null): void => {
        this.runActionOnFailedEv(
            (event) => Resend.removeFromQueue(MatrixClientPeg.safeGet(), event),
            (event) => canCancel(event.status),
        );
    };

    public onPinClick = async (_anchor: HTMLDivElement | null): Promise<void> => {
        const isPinned = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
        await PinningUtils.pinOrUnpinEvent(MatrixClientPeg.safeGet(), this.props.mxEvent);
        PosthogTrackers.trackPinUnpinMessage(isPinned ? "Pin" : "Unpin", "Timeline");
    };

    public onDownloadClick = async (_anchor: HTMLDivElement | null): Promise<void> => {
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

    public onHideClick = (_anchor: HTMLDivElement | null): void => {
        void setMediaVisibility(this.props.mxEvent, false);
    };

    public onToggleThreadExpanded = (anchor: HTMLDivElement | null): void => {
        this.props.onToggleThreadExpanded?.(anchor);
    };

    public onOptionsClick = (anchor: HTMLDivElement | null): void => {
        this.props.onOptionsClick?.(anchor);
    };

    public onReactionsClick = (anchor: HTMLDivElement | null): void => {
        this.props.onReactionsClick?.(anchor);
    };

    public onReplyInThreadClick = (_anchor: HTMLDivElement | null): void => {
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
