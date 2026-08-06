/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import {
    type MatrixClient,
    type MatrixEvent,
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
import { mediaFromMxc } from "../../../../customisations/Media";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { keepIfSame } from "../../../../utils/keepIfSame";
import {
    EventPreviewContentCache,
    getEventPreviewContent,
    MatrixEventContentChangeListener,
} from "./EventPreviewUtils";

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
    private memberListenerCleanups: Array<() => void> = [];
    private readonly eventContentListener = new MatrixEventContentChangeListener();
    private readonly previewContentCache = new EventPreviewContentCache();
    private watchedMemberRoom?: Room;
    private watchedMemberUserId?: string;
    private previewRequestId = 0;

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
        this.eventContentListener.teardown();
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
        this.eventContentListener.setEvent(lastReply, this.onEventContentChanged);
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

        const preview = getEventPreviewContent(mxEvent, this.previewContentCache);
        if (!preview) {
            this.setHidden();
            return;
        }

        this.snapshot.merge({
            ...baseSnapshot,
            ...preview,
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
