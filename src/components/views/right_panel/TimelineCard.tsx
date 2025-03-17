/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type IEventRelation,
    type MatrixEvent,
    NotificationCountType,
    type Room,
    type EventTimelineSet,
    type Thread,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import BaseCard from "./BaseCard";
import type ResizeNotifier from "../../../utils/ResizeNotifier";
import MessageComposer from "../rooms/MessageComposer";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { Layout } from "../../../settings/enums/Layout";
import TimelinePanel from "../../structures/TimelinePanel";
import { type E2EStatus } from "../../../utils/ShieldUtils";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import RoomContext, { type TimelineRenderingType } from "../../../contexts/RoomContext";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { Action } from "../../../dispatcher/actions";
import ContentMessages from "../../../ContentMessages";
import UploadBar from "../../structures/UploadBar";
import SettingsStore from "../../../settings/SettingsStore";
import JumpToBottomButton from "../rooms/JumpToBottomButton";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import Measured from "../elements/Measured";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";

interface IProps {
    room: Room;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
    e2eStatus?: E2EStatus;
    classNames?: string;
    timelineSet: EventTimelineSet;
    timelineRenderingType?: TimelineRenderingType;
    showComposer?: boolean;
    composerRelation?: IEventRelation;
}

interface IState {
    thread?: Thread;
    editState?: EditorStateTransfer;
    replyToEvent?: MatrixEvent;
    initialEventId?: string;
    isInitialEventHighlighted?: boolean;
    layout: Layout;
    atEndOfLiveTimeline: boolean;
    narrow: boolean;

    // settings:
    showReadReceipts?: boolean;
}

export default class TimelineCard extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private dispatcherRef?: string;
    private layoutWatcherRef?: string;
    private timelinePanel = React.createRef<TimelinePanel>();
    private card = React.createRef<HTMLDivElement>();
    private readReceiptsSettingWatcher: string | undefined;

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);
        this.state = {
            showReadReceipts: SettingsStore.getValue("showReadReceipts", props.room.roomId),
            layout: SettingsStore.getValue("layout"),
            atEndOfLiveTimeline: true,
            narrow: false,
        };
    }

    public componentDidMount(): void {
        SdkContextClass.instance.roomViewStore.addListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        this.dispatcherRef = dis.register(this.onAction);
        this.readReceiptsSettingWatcher = SettingsStore.watchSetting("showReadReceipts", null, (...[, , , value]) =>
            this.setState({ showReadReceipts: value as boolean }),
        );
        this.layoutWatcherRef = SettingsStore.watchSetting("layout", null, (...[, , , value]) =>
            this.setState({ layout: value as Layout }),
        );
    }

    public componentWillUnmount(): void {
        SdkContextClass.instance.roomViewStore.removeListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);

        SettingsStore.unwatchSetting(this.readReceiptsSettingWatcher);
        SettingsStore.unwatchSetting(this.layoutWatcherRef);

        dis.unregister(this.dispatcherRef);
    }

    private onRoomViewStoreUpdate = async (_initial?: boolean): Promise<void> => {
        const newState: Pick<IState, any> = {
            initialEventId: SdkContextClass.instance.roomViewStore.getInitialEventId(),
            isInitialEventHighlighted: SdkContextClass.instance.roomViewStore.isInitialEventHighlighted(),
            replyToEvent: SdkContextClass.instance.roomViewStore.getQuotingEvent(),
        };

        this.setState(newState);
    };

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case Action.EditEvent:
                this.setState(
                    {
                        editState: payload.event ? new EditorStateTransfer(payload.event) : undefined,
                    },
                    () => {
                        if (payload.event) {
                            this.timelinePanel.current?.scrollToEventIfNeeded(payload.event.getId());
                        }
                    },
                );
                break;
            default:
                break;
        }
    };

    private onScroll = (): void => {
        const timelinePanel = this.timelinePanel.current;
        if (!timelinePanel) return;
        if (timelinePanel.isAtEndOfLiveTimeline()) {
            this.setState({
                atEndOfLiveTimeline: true,
            });
        } else {
            this.setState({
                atEndOfLiveTimeline: false,
            });
        }

        if (this.state.initialEventId && this.state.isInitialEventHighlighted) {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.props.room.roomId,
                event_id: this.state.initialEventId,
                highlighted: false,
                replyingToEvent: this.state.replyToEvent,
                metricsTrigger: undefined, // room doesn't change
            });
        }
    };

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    private jumpToLiveTimeline = (): void => {
        if (this.state.initialEventId && this.state.isInitialEventHighlighted) {
            // If we were viewing a highlighted event, firing view_room without
            // an event will take care of both clearing the URL fragment and
            // jumping to the bottom
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: this.props.room.roomId,
            });
        } else {
            // Otherwise we have to jump manually
            this.timelinePanel.current?.jumpToLiveTimeline();
            dis.fire(Action.FocusSendMessageComposer);
        }
    };

    public render(): React.ReactNode {
        const highlightedEventId = this.state.isInitialEventHighlighted ? this.state.initialEventId : undefined;

        let jumpToBottom;
        if (!this.state.atEndOfLiveTimeline) {
            jumpToBottom = (
                <JumpToBottomButton
                    highlight={this.props.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0}
                    onScrollToBottomClick={this.jumpToLiveTimeline}
                />
            );
        }

        const isUploading = ContentMessages.sharedInstance().getCurrentUploads(this.props.composerRelation).length > 0;

        const myMembership = this.props.room.getMyMembership();
        const showComposer = myMembership === KnownMembership.Join;

        return (
            <ScopedRoomContextProvider
                {...this.context}
                timelineRenderingType={this.props.timelineRenderingType ?? this.context.timelineRenderingType}
                liveTimeline={this.props.timelineSet?.getLiveTimeline()}
                narrow={this.state.narrow}
            >
                <BaseCard
                    className={this.props.classNames}
                    onClose={this.props.onClose}
                    withoutScrollContainer={true}
                    header={_t("right_panel|video_room_chat|title")}
                    ref={this.card}
                >
                    <Measured sensor={this.card} onMeasurement={this.onMeasurement} />
                    <div className="mx_TimelineCard_timeline">
                        {jumpToBottom}
                        <TimelinePanel
                            ref={this.timelinePanel}
                            showReadReceipts={this.state.showReadReceipts}
                            manageReadReceipts={true}
                            manageReadMarkers={false} // No RM support in the TimelineCard
                            sendReadReceiptOnLoad={true}
                            timelineSet={this.props.timelineSet}
                            showUrlPreview={this.context.showUrlPreview}
                            // The right panel timeline (and therefore threads) don't support IRC layout at this time
                            layout={this.state.layout === Layout.Bubble ? Layout.Bubble : Layout.Group}
                            hideThreadedMessages={false}
                            hidden={false}
                            showReactions={true}
                            className="mx_RoomView_messagePanel"
                            permalinkCreator={this.props.permalinkCreator}
                            membersLoaded={true}
                            editState={this.state.editState}
                            eventId={this.state.initialEventId}
                            resizeNotifier={this.props.resizeNotifier}
                            highlightedEventId={highlightedEventId}
                            onScroll={this.onScroll}
                        />
                    </div>

                    {isUploading && <UploadBar room={this.props.room} relation={this.props.composerRelation} />}

                    {showComposer && (
                        <MessageComposer
                            room={this.props.room}
                            relation={this.props.composerRelation}
                            resizeNotifier={this.props.resizeNotifier}
                            replyToEvent={this.state.replyToEvent}
                            permalinkCreator={this.props.permalinkCreator}
                            e2eStatus={this.props.e2eStatus}
                            compact={true}
                        />
                    )}
                </BaseCard>
            </ScopedRoomContextProvider>
        );
    }
}
