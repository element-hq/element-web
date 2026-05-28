/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEvent, type ReactNode } from "react";
import {
    M_POLL_START,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    MsgType,
    type NotificationCount,
    RoomEvent,
    type Room,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type ThreadMessagePreviewAvatar,
    type ThreadMessagePreviewViewModel as ThreadMessagePreviewViewModelInterface,
    type ThreadMessagePreviewViewSnapshot,
    type ThreadSummaryViewModel as ThreadSummaryViewModelInterface,
    type ThreadSummaryViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ShowThreadPayload } from "../../../../dispatcher/payloads/ShowThreadPayload";
import PosthogTrackers from "../../../../PosthogTrackers";
import { determineUnreadState } from "../../../../RoomNotifs";
import { notificationLevelToIndicator } from "../../../../utils/notifications";
import { MessagePreviewStore } from "../../../../stores/message-preview";
import { mediaFromMxc } from "../../../../customisations/Media";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { keepIfSame } from "../../../../utils/keepIfSame";

const AVATAR_SIZE_PX = 24;
const THREAD_PROFILE_CONTEXTS = new Set<TimelineRenderingType>([
    TimelineRenderingType.Thread,
    TimelineRenderingType.ThreadsList,
]);

export interface ThreadMessagePreviewViewModelProps {
    /**
     * Matrix client used for event decryption and media URL resolution.
     */
    cli: MatrixClient;
    /**
     * Thread whose latest reply should be previewed.
     */
    thread: Thread;
    /**
     * Room context used to resolve current member profiles when configured.
     */
    room?: Room;
    /**
     * Timeline context used to match legacy current-profile behaviour in thread timelines.
     */
    timelineRenderingType: TimelineRenderingType;
    /**
     * Whether avatar images should be suppressed for low-bandwidth mode.
     */
    lowBandwidth?: boolean;
    /**
     * Whether to prefer current member profiles over historical event sender profiles.
     */
    useOnlyCurrentProfiles: boolean;
    /**
     * Whether to render the sender display name.
     */
    showDisplayName: boolean;
    /**
     * Optional class name for app-side avatar integration styling.
     */
    avatarClassName?: string;
}

export class ThreadMessagePreviewViewModel
    extends BaseViewModel<ThreadMessagePreviewViewSnapshot, ThreadMessagePreviewViewModelProps>
    implements ThreadMessagePreviewViewModelInterface
{
    private threadListenerCleanups: Array<() => void> = [];
    private eventListenerCleanups: Array<() => void> = [];
    private memberListenerCleanups: Array<() => void> = [];
    private watchedEvent?: MatrixEvent;
    private watchedMemberRoom?: Room;
    private watchedMemberUserId?: string;
    private previewRequestId = 0;
    private previewContentKey?: string;
    private previewContent?: ReactNode;

    public constructor(props: ThreadMessagePreviewViewModelProps) {
        super(props, {
            isVisible: false,
            showDisplayName: props.showDisplayName,
        });

        this.setupThreadListener();
        this.updateFromThreadSafely();
    }

    public dispose(): void {
        this.teardownThreadListener();
        this.teardownEventListeners();
        this.teardownMemberListener();
        super.dispose();
    }

    public setClient(cli: MatrixClient): void {
        if (this.props.cli === cli) return;
        this.props = { ...this.props, cli };
        this.updateFromThreadSafely();
    }

    public setThread(thread: Thread): void {
        if (this.props.thread === thread) return;
        this.props = { ...this.props, thread };
        this.setupThreadListener();
        this.updateFromThreadSafely();
    }

    public setRoom(room?: Room): void {
        if (this.props.room === room) return;
        this.props = { ...this.props, room };
        this.updateFromThreadSafely();
    }

    public setTimelineRenderingType(timelineRenderingType: TimelineRenderingType): void {
        if (this.props.timelineRenderingType === timelineRenderingType) return;
        this.props = { ...this.props, timelineRenderingType };
        this.updateFromThreadSafely();
    }

    public setLowBandwidth(lowBandwidth?: boolean): void {
        if (this.props.lowBandwidth === lowBandwidth) return;
        this.props = { ...this.props, lowBandwidth };
        this.updateFromThreadSafely();
    }

    public setUseOnlyCurrentProfiles(useOnlyCurrentProfiles: boolean): void {
        if (this.props.useOnlyCurrentProfiles === useOnlyCurrentProfiles) return;
        this.props = { ...this.props, useOnlyCurrentProfiles };
        this.updateFromThreadSafely();
    }

    public setShowDisplayName(showDisplayName: boolean): void {
        this.props = { ...this.props, showDisplayName };
        this.snapshot.merge({ showDisplayName });
    }

    private setupThreadListener(): void {
        this.teardownThreadListener();
        const { thread } = this.props;
        thread.on(ThreadEvent.Update, this.onThreadUpdate);
        this.threadListenerCleanups.push(() => {
            thread.off(ThreadEvent.Update, this.onThreadUpdate);
        });
    }

    private teardownThreadListener(): void {
        for (const cleanup of this.threadListenerCleanups) {
            cleanup();
        }
        this.threadListenerCleanups = [];
    }

    private setupEventListeners(mxEvent?: MatrixEvent): void {
        if (this.watchedEvent === mxEvent) return;

        this.teardownEventListeners();
        this.watchedEvent = mxEvent;

        if (!mxEvent) return;

        mxEvent.on(MatrixEventEvent.Replaced, this.onEventContentChanged);
        mxEvent.on(MatrixEventEvent.Decrypted, this.onEventContentChanged);
        this.eventListenerCleanups.push(() => {
            mxEvent.off(MatrixEventEvent.Replaced, this.onEventContentChanged);
            mxEvent.off(MatrixEventEvent.Decrypted, this.onEventContentChanged);
        });
    }

    private teardownEventListeners(): void {
        for (const cleanup of this.eventListenerCleanups) {
            cleanup();
        }
        this.eventListenerCleanups = [];
        this.watchedEvent = undefined;
    }

    private setupMemberListener(mxEvent?: MatrixEvent): void {
        const userId = ThreadMessagePreviewViewModel.getProfileUserId(mxEvent);
        const room = this.getProfileRoom();
        const shouldUseCurrentProfiles = this.shouldUseCurrentProfiles();

        if (!mxEvent || !userId || !room || !shouldUseCurrentProfiles) {
            this.teardownMemberListener();
            return;
        }

        if (this.watchedMemberRoom === room && this.watchedMemberUserId === userId) return;

        this.teardownMemberListener();
        this.watchedMemberRoom = room;
        this.watchedMemberUserId = userId;

        room.on(RoomStateEvent.Members, this.onRoomStateMember);
        this.memberListenerCleanups.push(() => {
            room.off(RoomStateEvent.Members, this.onRoomStateMember);
        });
    }

    private teardownMemberListener(): void {
        for (const cleanup of this.memberListenerCleanups) {
            cleanup();
        }
        this.memberListenerCleanups = [];
        this.watchedMemberRoom = undefined;
        this.watchedMemberUserId = undefined;
    }

    private readonly onThreadUpdate = (): void => {
        this.updateFromThreadSafely();
    };

    private readonly onEventContentChanged = (): void => {
        this.updateFromThreadSafely();
    };

    private readonly onRoomStateMember = (_event: MatrixEvent, _state: RoomState, member: RoomMember): void => {
        if (member.userId !== this.watchedMemberUserId) return;
        this.updateProfileSnapshot();
    };

    private updateFromThreadSafely(): void {
        void this.updateFromThread().catch((error) => {
            logger.error("Failed to update thread preview", error);
        });
    }

    private async updateFromThread(): Promise<void> {
        const requestId = ++this.previewRequestId;
        const lastReply = this.props.thread.replyToEvent ?? undefined;
        this.setupEventListeners(lastReply);
        this.setupMemberListener(lastReply);

        if (!lastReply) {
            this.setHidden();
            return;
        }

        await this.updateFromEvent(lastReply, requestId);
    }

    private async updateFromEvent(mxEvent: MatrixEvent, requestId: number): Promise<void> {
        if (mxEvent.isRedacted()) {
            this.setHidden();
            return;
        }

        const baseSnapshot = this.computeBaseReplySnapshot(mxEvent);

        if (mxEvent.isDecryptionFailure()) {
            this.setDecryptionFailure(baseSnapshot);
            return;
        }

        try {
            await this.props.cli.decryptEventIfNeeded(mxEvent);
        } catch (error) {
            logger.error("Failed to decrypt thread preview event", error);
            if (!this.isCurrentPreviewRequest(requestId, mxEvent)) return;

            if (mxEvent.isDecryptionFailure()) {
                this.setDecryptionFailure(baseSnapshot);
            } else {
                this.setHidden();
            }
            return;
        }

        if (!this.isCurrentPreviewRequest(requestId, mxEvent)) return;

        if (mxEvent.isRedacted()) {
            this.setHidden();
            return;
        }

        if (mxEvent.isDecryptionFailure()) {
            this.setDecryptionFailure(baseSnapshot);
            return;
        }

        const preview = MessagePreviewStore.instance.generatePreviewForEvent(mxEvent);
        if (!preview) {
            this.setHidden();
            return;
        }

        const prefix = ThreadMessagePreviewViewModel.getPreviewPrefix(
            mxEvent.getType(),
            mxEvent.getContent().msgtype as MsgType | undefined,
        );
        const previewContent = this.getPreviewContent(preview, prefix);

        this.snapshot.merge({
            ...baseSnapshot,
            previewContent,
            previewTooltip: prefix ? undefined : preview,
            isVisible: true,
        });
    }

    private isCurrentPreviewRequest(requestId: number, mxEvent: MatrixEvent): boolean {
        return !this.isDisposed && requestId === this.previewRequestId && this.props.thread.replyToEvent === mxEvent;
    }

    private computeBaseReplySnapshot(
        mxEvent: MatrixEvent,
    ): Pick<ThreadMessagePreviewViewSnapshot, "avatar" | "senderName" | "showDisplayName"> {
        const member = ThreadMessagePreviewViewModel.getDisplayMember(this.props, mxEvent);
        const sender = mxEvent.getSender() ?? "";
        const senderName = member?.name ?? sender;
        const avatar = ThreadMessagePreviewViewModel.computeAvatar(this.props, mxEvent, member);

        return {
            avatar: keepIfSame(this.snapshot.current.avatar, avatar),
            senderName,
            showDisplayName: this.props.showDisplayName,
        };
    }

    private updateProfileSnapshot(): void {
        const lastReply = this.props.thread.replyToEvent;
        if (!lastReply || !this.snapshot.current.isVisible) return;

        this.snapshot.merge(this.computeBaseReplySnapshot(lastReply));
    }

    private setDecryptionFailure(
        baseSnapshot: Pick<ThreadMessagePreviewViewSnapshot, "avatar" | "senderName" | "showDisplayName">,
    ): void {
        const label = _t("timeline|decryption_failure|unable_to_decrypt");
        this.snapshot.merge({
            ...baseSnapshot,
            previewContent: label,
            previewTooltip: label,
            isVisible: true,
        });
    }

    private setHidden(): void {
        this.snapshot.merge({
            isVisible: false,
            avatar: undefined,
            senderName: undefined,
            previewContent: undefined,
            previewTooltip: undefined,
            showDisplayName: this.props.showDisplayName,
        });
    }

    private getPreviewContent(preview: string, prefix: string | null): ReactNode {
        const key = `${prefix ?? ""}\u0000${preview}`;
        if (this.previewContentKey === key) {
            return this.previewContent;
        }

        this.previewContentKey = key;
        this.previewContent = prefix
            ? _t(
                  "event_preview|preview",
                  {
                      prefix,
                      preview,
                  },
                  {
                      bold: (sub) => <strong>{sub}</strong>,
                  },
              )
            : preview;

        return this.previewContent;
    }

    private static getPreviewPrefix(type: string, msgType?: MsgType): string | null {
        switch (type) {
            case M_POLL_START.name:
                return _t("event_preview|prefix|poll");
            default:
        }

        switch (msgType) {
            case MsgType.Audio:
                return _t("event_preview|prefix|audio");
            case MsgType.Image:
                return _t("event_preview|prefix|image");
            case MsgType.Video:
                return _t("event_preview|prefix|video");
            case MsgType.File:
                return _t("event_preview|prefix|file");
            default:
                return null;
        }
    }

    private static getDisplayMember(
        props: ThreadMessagePreviewViewModelProps,
        mxEvent: MatrixEvent,
    ): RoomMember | null | undefined {
        const userId = ThreadMessagePreviewViewModel.getProfileUserId(mxEvent);
        if (userId && ThreadMessagePreviewViewModel.shouldUseCurrentProfilesForProps(props)) {
            const currentMember = ThreadMessagePreviewViewModel.getProfileRoomForProps(props)?.getMember(userId);
            if (currentMember) return currentMember;
        }

        return mxEvent.sender;
    }

    private getProfileRoom(): Room | undefined {
        return ThreadMessagePreviewViewModel.getProfileRoomForProps(this.props);
    }

    private shouldUseCurrentProfiles(): boolean {
        return ThreadMessagePreviewViewModel.shouldUseCurrentProfilesForProps(this.props);
    }

    private static getProfileRoomForProps(props: ThreadMessagePreviewViewModelProps): Room | undefined {
        return props.room ?? props.thread.room;
    }

    private static shouldUseCurrentProfilesForProps(props: ThreadMessagePreviewViewModelProps): boolean {
        return props.useOnlyCurrentProfiles || THREAD_PROFILE_CONTEXTS.has(props.timelineRenderingType);
    }

    private static getProfileUserId(mxEvent?: MatrixEvent): string {
        return mxEvent?.sender?.userId ?? mxEvent?.getSender() ?? "";
    }

    private static computeAvatar(
        props: ThreadMessagePreviewViewModelProps,
        mxEvent: MatrixEvent,
        member: RoomMember | null | undefined,
    ): ThreadMessagePreviewAvatar {
        const fallbackUserId = mxEvent.getSender() ?? "";
        const name = member?.name ?? fallbackUserId;
        let src: string | undefined;
        let title: string | undefined;

        if (member?.name) {
            const mxcAvatarUrl = member.getMxcAvatarUrl();
            if (mxcAvatarUrl && !props.lowBandwidth) {
                src =
                    mediaFromMxc(mxcAvatarUrl, props.cli).getThumbnailOfSourceHttp(
                        AVATAR_SIZE_PX,
                        AVATAR_SIZE_PX,
                        "crop",
                    ) ?? undefined;
            }

            title =
                UserIdentifierCustomisations.getDisplayUserIdentifier(member.userId, {
                    roomId: member.roomId,
                }) ?? fallbackUserId;
        }

        return {
            className: props.avatarClassName,
            id: member?.userId ?? fallbackUserId,
            name,
            src,
            title,
            label: _t("common|user_avatar"),
        };
    }
}

export interface ThreadSummaryViewModelProps extends Omit<ThreadMessagePreviewViewModelProps, "showDisplayName"> {
    /**
     * Thread root event opened by the summary.
     */
    mxEvent: MatrixEvent;
    /**
     * Whether the timeline is in narrow mode.
     */
    narrow: boolean;
    /**
     * Whether opening the thread should push a card.
     */
    isCard: boolean;
}

export class ThreadSummaryViewModel
    extends BaseViewModel<ThreadSummaryViewSnapshot, ThreadSummaryViewModelProps>
    implements ThreadSummaryViewModelInterface
{
    private listenerCleanups: Array<() => void> = [];
    private readonly previewVm: ThreadMessagePreviewViewModel;

    public constructor(props: ThreadSummaryViewModelProps) {
        const previewVm = new ThreadMessagePreviewViewModel({
            ...props,
            showDisplayName: !props.narrow,
        });

        super(props, ThreadSummaryViewModel.computeSnapshot(props, previewVm));
        this.previewVm = previewVm;
        this.disposables.track(previewVm);
        this.setupListeners();
    }

    public dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    public setRootEvent(mxEvent: MatrixEvent): void {
        this.props = { ...this.props, mxEvent };
    }

    public setClient(cli: MatrixClient): void {
        if (this.props.cli === cli) return;
        this.props = { ...this.props, cli };
        this.previewVm.setClient(cli);
    }

    public setThread(thread: Thread): void {
        if (this.props.thread === thread) return;
        this.props = { ...this.props, thread };
        this.previewVm.setThread(thread);
        this.setupListeners();
        this.updateSnapshotFromProps();
    }

    public setRoom(room?: Room): void {
        if (this.props.room === room) return;
        this.props = { ...this.props, room };
        this.previewVm.setRoom(room);
    }

    public setTimelineRenderingType(timelineRenderingType: TimelineRenderingType): void {
        if (this.props.timelineRenderingType === timelineRenderingType) return;
        this.props = { ...this.props, timelineRenderingType };
        this.previewVm.setTimelineRenderingType(timelineRenderingType);
    }

    public setLowBandwidth(lowBandwidth?: boolean): void {
        if (this.props.lowBandwidth === lowBandwidth) return;
        this.props = { ...this.props, lowBandwidth };
        this.previewVm.setLowBandwidth(lowBandwidth);
    }

    public setUseOnlyCurrentProfiles(useOnlyCurrentProfiles: boolean): void {
        if (this.props.useOnlyCurrentProfiles === useOnlyCurrentProfiles) return;
        this.props = { ...this.props, useOnlyCurrentProfiles };
        this.previewVm.setUseOnlyCurrentProfiles(useOnlyCurrentProfiles);
    }

    public setNarrow(narrow: boolean): void {
        this.props = { ...this.props, narrow };
        this.previewVm.setShowDisplayName(!narrow);
        this.snapshot.merge(ThreadSummaryViewModel.computeLayoutSnapshot(this.props));
    }

    public setIsCard(isCard: boolean): void {
        this.props = { ...this.props, isCard };
    }

    public onClick = (event: MouseEvent<HTMLButtonElement>): void => {
        defaultDispatcher.dispatch<ShowThreadPayload>({
            action: Action.ShowThread,
            rootEvent: this.props.mxEvent,
            push: this.props.isCard,
        });
        PosthogTrackers.trackInteraction("WebRoomTimelineThreadSummaryButton", event);
    };

    private setupListeners(): void {
        this.teardownListeners();

        const { thread } = this.props;
        const { room } = thread;
        thread.on(ThreadEvent.Update, this.onThreadUpdate);
        this.listenerCleanups.push(() => {
            thread.off(ThreadEvent.Update, this.onThreadUpdate);
        });

        room.on(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
        room.on(RoomEvent.Receipt, this.onNotificationChanged);
        room.on(RoomEvent.Timeline, this.onNotificationChanged);
        room.on(RoomEvent.Redaction, this.onNotificationChanged);
        room.on(RoomEvent.LocalEchoUpdated, this.onNotificationChanged);
        room.on(RoomEvent.MyMembership, this.onNotificationChanged);
        this.listenerCleanups.push(() => {
            room.off(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
            room.off(RoomEvent.Receipt, this.onNotificationChanged);
            room.off(RoomEvent.Timeline, this.onNotificationChanged);
            room.off(RoomEvent.Redaction, this.onNotificationChanged);
            room.off(RoomEvent.LocalEchoUpdated, this.onNotificationChanged);
            room.off(RoomEvent.MyMembership, this.onNotificationChanged);
        });
    }

    private teardownListeners(): void {
        for (const cleanup of this.listenerCleanups) {
            cleanup();
        }
        this.listenerCleanups = [];
    }

    private readonly onThreadUpdate = (): void => {
        this.updateSnapshotFromProps();
    };

    private readonly onRoomUnreadNotifications = (
        _unreadNotifications?: NotificationCount,
        eventThreadId?: string,
    ): void => {
        if (eventThreadId && eventThreadId !== this.props.thread.id) return;
        this.updateNotificationSnapshot();
    };

    private readonly onNotificationChanged = (): void => {
        this.updateNotificationSnapshot();
    };

    private updateSnapshotFromProps(): void {
        this.snapshot.merge({
            ...ThreadSummaryViewModel.computeLayoutSnapshot(this.props),
            notificationIndicator: ThreadSummaryViewModel.computeNotificationIndicator(this.props),
        });
    }

    private updateNotificationSnapshot(): void {
        this.snapshot.merge({
            notificationIndicator: ThreadSummaryViewModel.computeNotificationIndicator(this.props),
        });
    }

    private static computeSnapshot(
        props: ThreadSummaryViewModelProps,
        previewVm: ThreadMessagePreviewViewModel,
    ): ThreadSummaryViewSnapshot {
        return {
            openThreadLabel: _t("threads|open_thread"),
            previewVm,
            notificationIndicator: ThreadSummaryViewModel.computeNotificationIndicator(props),
            ...ThreadSummaryViewModel.computeLayoutSnapshot(props),
        };
    }

    private static computeLayoutSnapshot(
        props: ThreadSummaryViewModelProps,
    ): Pick<ThreadSummaryViewSnapshot, "isVisible" | "replyCountLabel" | "narrow"> {
        const count = props.thread.length;

        return {
            isVisible: count > 0,
            replyCountLabel: props.narrow ? String(count) : _t("threads|count_of_reply", { count }),
            narrow: props.narrow,
        };
    }

    private static computeNotificationIndicator(
        props: ThreadSummaryViewModelProps,
    ): ThreadSummaryViewSnapshot["notificationIndicator"] {
        const { level } = determineUnreadState(props.thread.room, props.thread.id, false);
        return notificationLevelToIndicator(level);
    }
}
