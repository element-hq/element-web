/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import classNames from "classnames";
import { NotificationCountType, Room, RoomEvent, ThreadEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import HeaderButton from "./HeaderButton";
import HeaderButtons, { HeaderKind } from "./HeaderButtons";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { ActionPayload } from "../../../dispatcher/payloads";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { useReadPinnedEvents, usePinnedEvents } from "./PinnedMessagesCard";
import { showThreadPanel } from "../../../dispatcher/dispatch-actions/threads";
import SettingsStore from "../../../settings/SettingsStore";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { SummarizedNotificationState } from "../../../stores/notifications/SummarizedNotificationState";
import PosthogTrackers from "../../../PosthogTrackers";
import { ButtonEvent } from "../elements/AccessibleButton";
import { doesRoomOrThreadHaveUnreadMessages } from "../../../Unread";

const ROOM_INFO_PHASES = [
    RightPanelPhases.RoomSummary,
    RightPanelPhases.Widget,
    RightPanelPhases.FilePanel,
    RightPanelPhases.RoomMemberList,
    RightPanelPhases.RoomMemberInfo,
    RightPanelPhases.EncryptionPanel,
    RightPanelPhases.Room3pidMemberInfo,
];

interface IUnreadIndicatorProps {
    color?: NotificationLevel;
}

const UnreadIndicator: React.FC<IUnreadIndicatorProps> = ({ color }) => {
    if (color === NotificationLevel.None) {
        return null;
    }

    const classes = classNames({
        mx_Indicator: true,
        mx_LegacyRoomHeader_button_unreadIndicator: true,
        mx_Indicator_activity: color === NotificationLevel.Activity,
        mx_Indicator_notification: color === NotificationLevel.Notification,
        mx_Indicator_highlight: color === NotificationLevel.Highlight,
    });
    return (
        <>
            <div className="mx_LegacyRoomHeader_button_unreadIndicator_bg" />
            <div className={classes} />
        </>
    );
};

interface IHeaderButtonProps {
    room: Room;
    isHighlighted: boolean;
    onClick: () => void;
}

const PinnedMessagesHeaderButton: React.FC<IHeaderButtonProps> = ({ room, isHighlighted, onClick }) => {
    const pinnedEvents = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);
    if (!pinnedEvents?.length) return null;

    let unreadIndicator;
    if (pinnedEvents.some((id) => !readPinnedEvents.has(id))) {
        unreadIndicator = <UnreadIndicator />;
    }

    return (
        <HeaderButton
            name="pinnedMessagesButton"
            title={_t("right_panel|pinned_messages|title")}
            isHighlighted={isHighlighted}
            isUnread={!!unreadIndicator}
            onClick={onClick}
        >
            {unreadIndicator}
        </HeaderButton>
    );
};

const TimelineCardHeaderButton: React.FC<IHeaderButtonProps> = ({ room, isHighlighted, onClick }) => {
    let unreadIndicator;
    const color = RoomNotificationStateStore.instance.getRoomState(room).level;
    switch (color) {
        case NotificationLevel.Activity:
        case NotificationLevel.Notification:
        case NotificationLevel.Highlight:
            unreadIndicator = <UnreadIndicator color={color} />;
    }
    return (
        <HeaderButton
            name="timelineCardButton"
            title={_t("right_panel|video_room_chat|title")}
            isHighlighted={isHighlighted}
            onClick={onClick}
        >
            {unreadIndicator}
        </HeaderButton>
    );
};

interface IProps {
    room?: Room;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
}

/**
 * @deprecated will be removed as part of 'feature_new_room_decoration_ui'
 */
export default class LegacyRoomHeaderButtons extends HeaderButtons<IProps> {
    private static readonly THREAD_PHASES = [RightPanelPhases.ThreadPanel, RightPanelPhases.ThreadView];
    private globalNotificationState: SummarizedNotificationState;

    public constructor(props: IProps) {
        super(props, HeaderKind.Room);
        this.globalNotificationState = RoomNotificationStateStore.instance.globalState;
    }

    public componentDidMount(): void {
        super.componentDidMount();
        // Notification badge may change if the notification counts from the
        // server change, if a new thread is created or updated, or if a
        // receipt is sent in the thread.
        this.props.room?.on(RoomEvent.UnreadNotifications, this.onNotificationUpdate);
        this.props.room?.on(RoomEvent.Receipt, this.onNotificationUpdate);
        this.props.room?.on(RoomEvent.Timeline, this.onNotificationUpdate);
        this.props.room?.on(RoomEvent.Redaction, this.onNotificationUpdate);
        this.props.room?.on(RoomEvent.LocalEchoUpdated, this.onNotificationUpdate);
        this.props.room?.on(RoomEvent.MyMembership, this.onNotificationUpdate);
        this.props.room?.on(ThreadEvent.New, this.onNotificationUpdate);
        this.props.room?.on(ThreadEvent.Update, this.onNotificationUpdate);
        this.onNotificationUpdate();
        RoomNotificationStateStore.instance.on(UPDATE_STATUS_INDICATOR, this.onUpdateStatus);
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount();
        this.props.room?.off(RoomEvent.UnreadNotifications, this.onNotificationUpdate);
        this.props.room?.off(RoomEvent.Receipt, this.onNotificationUpdate);
        this.props.room?.off(RoomEvent.Timeline, this.onNotificationUpdate);
        this.props.room?.off(RoomEvent.Redaction, this.onNotificationUpdate);
        this.props.room?.off(RoomEvent.LocalEchoUpdated, this.onNotificationUpdate);
        this.props.room?.off(RoomEvent.MyMembership, this.onNotificationUpdate);
        this.props.room?.off(ThreadEvent.New, this.onNotificationUpdate);
        this.props.room?.off(ThreadEvent.Update, this.onNotificationUpdate);
        RoomNotificationStateStore.instance.off(UPDATE_STATUS_INDICATOR, this.onUpdateStatus);
    }

    private onNotificationUpdate = (): void => {
        // console.log
        // XXX: why don't we read from this.state.threadNotificationLevel in the render methods?
        this.setState({
            threadNotificationLevel: this.notificationLevel,
        });
    };

    private get notificationLevel(): NotificationLevel {
        switch (this.props.room?.threadsAggregateNotificationType) {
            case NotificationCountType.Highlight:
                return NotificationLevel.Highlight;
            case NotificationCountType.Total:
                return NotificationLevel.Notification;
        }
        // We don't have any notified messages, but we might have unread messages. Let's
        // find out.
        for (const thread of this.props.room!.getThreads()) {
            // If the current thread has unread messages, we're done.
            if (doesRoomOrThreadHaveUnreadMessages(thread)) {
                return NotificationLevel.Activity;
            }
        }
        // Otherwise, no notification color.
        return NotificationLevel.None;
    }

    private onUpdateStatus = (notificationState: SummarizedNotificationState): void => {
        // XXX: why don't we read from this.state.globalNotificationCount in the render methods?
        this.globalNotificationState = notificationState;
        this.setState({
            globalNotificationLevel: notificationState.level,
        });
    };

    protected onAction(payload: ActionPayload): void {}

    private onRoomSummaryClicked = (): void => {
        // use roomPanelPhase rather than this.state.phase as it remembers the latest one if we close
        const currentPhase = RightPanelStore.instance.currentCard.phase;
        if (currentPhase && ROOM_INFO_PHASES.includes(currentPhase)) {
            if (this.state.phase === currentPhase) {
                RightPanelStore.instance.showOrHidePanel(currentPhase);
            } else {
                RightPanelStore.instance.showOrHidePanel(currentPhase, RightPanelStore.instance.currentCard.state);
            }
        } else {
            // This toggles for us, if needed
            RightPanelStore.instance.showOrHidePanel(RightPanelPhases.RoomSummary);
        }
    };

    private onNotificationsClicked = (): void => {
        // This toggles for us, if needed
        RightPanelStore.instance.showOrHidePanel(RightPanelPhases.NotificationPanel);
    };

    private onPinnedMessagesClicked = (): void => {
        // This toggles for us, if needed
        RightPanelStore.instance.showOrHidePanel(RightPanelPhases.PinnedMessages);
    };
    private onTimelineCardClicked = (): void => {
        RightPanelStore.instance.showOrHidePanel(RightPanelPhases.Timeline);
    };

    private onThreadsPanelClicked = (ev: ButtonEvent): void => {
        if (this.state.phase && LegacyRoomHeaderButtons.THREAD_PHASES.includes(this.state.phase)) {
            RightPanelStore.instance.togglePanel(this.props.room?.roomId ?? null);
        } else {
            showThreadPanel();
            PosthogTrackers.trackInteraction("WebRoomHeaderButtonsThreadsButton", ev);
        }
    };

    public renderButtons(): JSX.Element {
        if (!this.props.room) {
            return <></>;
        }

        const rightPanelPhaseButtons: Map<RightPanelPhases, any> = new Map();

        if (SettingsStore.getValue("feature_pinning")) {
            rightPanelPhaseButtons.set(
                RightPanelPhases.PinnedMessages,
                <PinnedMessagesHeaderButton
                    key="pinnedMessagesButton"
                    room={this.props.room}
                    isHighlighted={this.isPhase(RightPanelPhases.PinnedMessages)}
                    onClick={this.onPinnedMessagesClicked}
                />,
            );
        }
        rightPanelPhaseButtons.set(
            RightPanelPhases.Timeline,
            <TimelineCardHeaderButton
                key="timelineButton"
                room={this.props.room}
                isHighlighted={this.isPhase(RightPanelPhases.Timeline)}
                onClick={this.onTimelineCardClicked}
            />,
        );
        rightPanelPhaseButtons.set(
            RightPanelPhases.ThreadPanel,
            <HeaderButton
                key={RightPanelPhases.ThreadPanel}
                name="threadsButton"
                data-testid="threadsButton"
                title={_t("common|threads")}
                onClick={this.onThreadsPanelClicked}
                isHighlighted={this.isPhase(LegacyRoomHeaderButtons.THREAD_PHASES)}
                isUnread={this.state.threadNotificationLevel > NotificationLevel.None}
            >
                <UnreadIndicator color={this.state.threadNotificationLevel} />
            </HeaderButton>,
        );
        if (this.state.notificationsEnabled) {
            rightPanelPhaseButtons.set(
                RightPanelPhases.NotificationPanel,
                <HeaderButton
                    key="notifsButton"
                    name="notifsButton"
                    title={_t("notifications|enable_prompt_toast_title")}
                    isHighlighted={this.isPhase(RightPanelPhases.NotificationPanel)}
                    onClick={this.onNotificationsClicked}
                    isUnread={this.globalNotificationState.level === NotificationLevel.Highlight}
                >
                    {this.globalNotificationState.level === NotificationLevel.Highlight ? (
                        <UnreadIndicator color={this.globalNotificationState.level} />
                    ) : null}
                </HeaderButton>,
            );
        }
        rightPanelPhaseButtons.set(
            RightPanelPhases.RoomSummary,
            <HeaderButton
                key="roomSummaryButton"
                name="roomSummaryButton"
                title={_t("right_panel|room_summary_card|title")}
                isHighlighted={this.isPhase(ROOM_INFO_PHASES)}
                onClick={this.onRoomSummaryClicked}
            />,
        );

        return (
            <>
                {Array.from(rightPanelPhaseButtons.keys()).map((phase) =>
                    this.props.excludedRightPanelPhaseButtons?.includes(phase)
                        ? null
                        : rightPanelPhaseButtons.get(phase),
                )}
            </>
        );
    }
}
