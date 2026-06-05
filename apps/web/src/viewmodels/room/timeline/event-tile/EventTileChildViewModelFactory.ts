/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventPreviewViewModel, type EventPreviewViewModelProps } from "./EventPreviewViewModel";
import {
    E2eMessageSharedIconViewModel,
    type E2eMessageSharedIconViewModelProps,
} from "./E2eMessageSharedIconViewModel";
import { MessageTimestampViewModel, type MessageTimestampViewModelProps } from "./timestamp/MessageTimestampViewModel";
import {
    ThreadMessagePreviewViewModel,
    type ThreadMessagePreviewViewModelProps,
    ThreadSummaryViewModel,
    type ThreadSummaryViewModelProps,
} from "./ThreadSummaryViewModel";
import {
    ThreadListActionBarViewModel,
    type ThreadListActionBarViewModelProps,
} from "../../ThreadListActionBarViewModel";
import { EventTileActionBarViewModel, type EventTileActionBarViewModelProps } from "../../EventTileActionBarViewModel";
import { ReactionsRowViewModel, type ReactionsRowViewModelProps } from "./reactions/ReactionsRowViewModel";

/**
 * App-side owner for EventTile child view models.
 *
 * This keeps the Matrix-aware VM lifecycle out of `EventTileViewModel` so the
 * parent VM can remain focused on tile-level derivation.
 */
export class EventTileChildViewModelFactory {
    private messageTimestampViewModel?: MessageTimestampViewModel;
    private linkedMessageTimestampViewModel?: MessageTimestampViewModel;
    private threadMessagePreviewViewModel?: ThreadMessagePreviewViewModel;
    private threadSummaryViewModel?: ThreadSummaryViewModel;
    private threadListActionBarViewModel?: ThreadListActionBarViewModel;
    private e2eMessageSharedIconViewModel?: E2eMessageSharedIconViewModel;
    private eventPreviewViewModel?: EventPreviewViewModel;
    private actionBarViewModel?: EventTileActionBarViewModel;
    private reactionsRowViewModel?: ReactionsRowViewModel;

    public dispose(): void {
        this.messageTimestampViewModel?.dispose();
        this.linkedMessageTimestampViewModel?.dispose();
        this.threadMessagePreviewViewModel?.dispose();
        this.threadSummaryViewModel?.dispose();
        this.threadListActionBarViewModel?.dispose();
        this.e2eMessageSharedIconViewModel?.dispose();
        this.eventPreviewViewModel?.dispose();
        this.actionBarViewModel?.dispose();
        this.reactionsRowViewModel?.dispose();

        this.messageTimestampViewModel = undefined;
        this.linkedMessageTimestampViewModel = undefined;
        this.threadMessagePreviewViewModel = undefined;
        this.threadSummaryViewModel = undefined;
        this.threadListActionBarViewModel = undefined;
        this.e2eMessageSharedIconViewModel = undefined;
        this.eventPreviewViewModel = undefined;
        this.actionBarViewModel = undefined;
        this.reactionsRowViewModel = undefined;
    }

    public getMessageTimestampViewModel(props: MessageTimestampViewModelProps): MessageTimestampViewModel {
        this.messageTimestampViewModel ??= new MessageTimestampViewModel(props);
        this.messageTimestampViewModel.setProps(props);
        return this.messageTimestampViewModel;
    }

    public getLinkedMessageTimestampViewModel(props: MessageTimestampViewModelProps): MessageTimestampViewModel {
        this.linkedMessageTimestampViewModel ??= new MessageTimestampViewModel(props);
        this.linkedMessageTimestampViewModel.setProps(props);
        return this.linkedMessageTimestampViewModel;
    }

    public getThreadMessagePreviewViewModel(props: ThreadMessagePreviewViewModelProps): ThreadMessagePreviewViewModel {
        this.threadMessagePreviewViewModel ??= new ThreadMessagePreviewViewModel(props);
        this.threadMessagePreviewViewModel.setClient(props.cli);
        this.threadMessagePreviewViewModel.setThread(props.thread);
        this.threadMessagePreviewViewModel.setRoom(props.room);
        this.threadMessagePreviewViewModel.setTimelineRenderingType(props.timelineRenderingType);
        this.threadMessagePreviewViewModel.setLowBandwidth(props.lowBandwidth);
        this.threadMessagePreviewViewModel.setUseOnlyCurrentProfiles(props.useOnlyCurrentProfiles);
        this.threadMessagePreviewViewModel.setShowDisplayName(props.showDisplayName);
        return this.threadMessagePreviewViewModel;
    }

    public releaseThreadMessagePreviewViewModel(): void {
        this.threadMessagePreviewViewModel?.dispose();
        this.threadMessagePreviewViewModel = undefined;
    }

    public getThreadSummaryViewModel(props: ThreadSummaryViewModelProps): ThreadSummaryViewModel {
        this.threadSummaryViewModel ??= new ThreadSummaryViewModel(props);
        this.threadSummaryViewModel.setRootEvent(props.mxEvent);
        this.threadSummaryViewModel.setClient(props.cli);
        this.threadSummaryViewModel.setThread(props.thread);
        this.threadSummaryViewModel.setRoom(props.room);
        this.threadSummaryViewModel.setTimelineRenderingType(props.timelineRenderingType);
        this.threadSummaryViewModel.setLowBandwidth(props.lowBandwidth);
        this.threadSummaryViewModel.setUseOnlyCurrentProfiles(props.useOnlyCurrentProfiles);
        this.threadSummaryViewModel.setNarrow(props.narrow);
        this.threadSummaryViewModel.setIsCard(props.isCard);
        return this.threadSummaryViewModel;
    }

    public releaseThreadSummaryViewModel(): void {
        this.threadSummaryViewModel?.dispose();
        this.threadSummaryViewModel = undefined;
    }

    public getThreadListActionBarViewModel(props: ThreadListActionBarViewModelProps): ThreadListActionBarViewModel {
        this.threadListActionBarViewModel ??= new ThreadListActionBarViewModel(props);
        this.threadListActionBarViewModel.setProps(props);
        return this.threadListActionBarViewModel;
    }

    public releaseThreadListActionBarViewModel(): void {
        this.threadListActionBarViewModel?.dispose();
        this.threadListActionBarViewModel = undefined;
    }

    public getE2eMessageSharedIconViewModel(props: E2eMessageSharedIconViewModelProps): E2eMessageSharedIconViewModel {
        this.e2eMessageSharedIconViewModel ??= new E2eMessageSharedIconViewModel(props);
        this.e2eMessageSharedIconViewModel.setClient(props.client);
        this.e2eMessageSharedIconViewModel.setRoomId(props.roomId);
        this.e2eMessageSharedIconViewModel.setKeyForwardingUserId(props.keyForwardingUserId);
        return this.e2eMessageSharedIconViewModel;
    }

    public releaseE2eMessageSharedIconViewModel(): void {
        this.e2eMessageSharedIconViewModel?.dispose();
        this.e2eMessageSharedIconViewModel = undefined;
    }

    public getEventPreviewViewModel(props: EventPreviewViewModelProps): EventPreviewViewModel {
        this.eventPreviewViewModel ??= new EventPreviewViewModel(props);
        this.eventPreviewViewModel.setClient(props.cli);
        this.eventPreviewViewModel.setEvent(props.mxEvent);
        return this.eventPreviewViewModel;
    }

    public releaseEventPreviewViewModel(): void {
        this.eventPreviewViewModel?.dispose();
        this.eventPreviewViewModel = undefined;
    }

    public getActionBarViewModel(props: EventTileActionBarViewModelProps): EventTileActionBarViewModel {
        this.actionBarViewModel ??= new EventTileActionBarViewModel(props);
        this.actionBarViewModel.setProps(props);
        return this.actionBarViewModel;
    }

    public releaseActionBarViewModel(): void {
        this.actionBarViewModel?.dispose();
        this.actionBarViewModel = undefined;
    }

    public getReactionsRowViewModel(props: ReactionsRowViewModelProps): ReactionsRowViewModel {
        this.reactionsRowViewModel ??= new ReactionsRowViewModel(props);
        this.reactionsRowViewModel.setActionable(props.isActionable);
        this.reactionsRowViewModel.setReactionGroupCount(props.reactionGroupCount);
        this.reactionsRowViewModel.setCanReact(props.canReact);
        this.reactionsRowViewModel.setAddReactionButtonActive(props.addReactionButtonActive ?? false);
        this.reactionsRowViewModel.setAddReactionHandlers({
            onAddReactionClick: props.onAddReactionClick,
            onAddReactionContextMenu: props.onAddReactionContextMenu,
        });
        return this.reactionsRowViewModel;
    }

    public releaseReactionsRowViewModel(): void {
        this.reactionsRowViewModel?.dispose();
        this.reactionsRowViewModel = undefined;
    }
}

export function createEventTileChildViewModelFactory(): EventTileChildViewModelFactory {
    return new EventTileChildViewModelFactory();
}
