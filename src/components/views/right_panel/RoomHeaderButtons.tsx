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
import { NotificationCountType, Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { ThreadEvent } from "matrix-js-sdk/src/models/thread";

import { _t } from "../../../languageHandler";
import HeaderButton from "./HeaderButton";
import HeaderButtons, { HeaderKind } from "./HeaderButtons";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { Action } from "../../../dispatcher/actions";
import { ActionPayload } from "../../../dispatcher/payloads";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { useReadPinnedEvents, usePinnedEvents } from "./PinnedMessagesCard";
import { showThreadPanel } from "../../../dispatcher/dispatch-actions/threads";
import SettingsStore from "../../../settings/SettingsStore";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
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
    color?: NotificationColor;
}

const UnreadIndicator: React.FC<IUnreadIndicatorProps> = ({ color }) => {
    if (color === NotificationColor.None) {
        return null;
    }

    const classes = classNames({
        mx_Indicator: true,
        mx_RoomHeader_button_unreadIndicator: true,
        mx_Indicator_bold: color === NotificationColor.Bold,
        mx_Indicator_gray: color === NotificationColor.Grey,
        mx_Indicator_red: color === NotificationColor.Red,
    });
    return (
        <>
            <div className="mx_RoomHeader_button_unreadIndicator_bg" />
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
            title={_t("Pinned messages")}
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
    const color = RoomNotificationStateStore.instance.getRoomState(room).color;
    switch (color) {
        case NotificationColor.Bold:
        case NotificationColor.Grey:
        case NotificationColor.Red:
            unreadIndicator = <UnreadIndicator color={color} />;
    }
    return (
        <HeaderButton name="timelineCardButton" title={_t("Chat")} isHighlighted={isHighlighted} onClick={onClick}>
            {unreadIndicator}
        </HeaderButton>
    );
};

interface IProps {
    room?: Room;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
}

export default class RoomHeaderButtons extends HeaderButtons<IProps> {
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
        // XXX: why don't we read from this.state.threadNotificationColor in the render methods?
        this.setState({
            threadNotificationColor: this.notificationColor,
        });
    };

    private get notificationColor(): NotificationColor {
        switch (this.props.room?.threadsAggregateNotificationType) {
            case NotificationCountType.Highlight:
                return NotificationColor.Red;
            case NotificationCountType.Total:
                return NotificationColor.Grey;
        }
        // We don't have any notified messages, but we might have unread messages. Let's
        // find out.
        for (const thread of this.props.room!.getThreads()) {
            // If the current thread has unread messages, we're done.
            if (doesRoomOrThreadHaveUnreadMessages(thread)) {
                return NotificationColor.Bold;
            }
        }
        // Otherwise, no notification color.
        return NotificationColor.None;
    }

    private onUpdateStatus = (notificationState: SummarizedNotificationState): void => {
        // XXX: why don't we read from this.state.globalNotificationCount in the render methods?
        this.globalNotificationState = notificationState;
        this.setState({
            globalNotificationColor: notificationState.color,
        });
    };

    protected onAction(payload: ActionPayload): void {
        if (payload.action === Action.ViewUser) {
            if (payload.member) {
                if (payload.push) {
                    RightPanelStore.instance.pushCard({
                        phase: RightPanelPhases.RoomMemberInfo,
                        state: { member: payload.member },
                    });
                } else {
                    RightPanelStore.instance.setCards([
                        { phase: RightPanelPhases.RoomSummary },
                        { phase: RightPanelPhases.RoomMemberList },
                        { phase: RightPanelPhases.RoomMemberInfo, state: { member: payload.member } },
                    ]);
                }
            } else {
                this.setPhase(RightPanelPhases.RoomMemberList);
            }
        } else if (payload.action === "view_3pid_invite") {
            if (payload.event) {
                this.setPhase(RightPanelPhases.Room3pidMemberInfo, { memberInfoEvent: payload.event });
            } else {
                this.setPhase(RightPanelPhases.RoomMemberList);
            }
        }
    }

    private onRoomSummaryClicked = (): void => {
        // use roomPanelPhase rather than this.state.phase as it remembers the latest one if we close
        const currentPhase = RightPanelStore.instance.currentCard.phase;
        if (currentPhase && ROOM_INFO_PHASES.includes(currentPhase)) {
            if (this.state.phase === currentPhase) {
                this.setPhase(currentPhase);
            } else {
                this.setPhase(currentPhase, RightPanelStore.instance.currentCard.state);
            }
        } else {
            // This toggles for us, if needed
            this.setPhase(RightPanelPhases.RoomSummary);
        }
    };

    private onNotificationsClicked = (): void => {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.NotificationPanel);
    };

    private onPinnedMessagesClicked = (): void => {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.PinnedMessages);
    };
    private onTimelineCardClicked = (): void => {
        this.setPhase(RightPanelPhases.Timeline);
    };

    private onThreadsPanelClicked = (ev: ButtonEvent): void => {
        if (this.state.phase && RoomHeaderButtons.THREAD_PHASES.includes(this.state.phase)) {
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
                title={_t("Threads")}
                onClick={this.onThreadsPanelClicked}
                isHighlighted={this.isPhase(RoomHeaderButtons.THREAD_PHASES)}
                isUnread={this.state.threadNotificationColor > NotificationColor.None}
            >
                <UnreadIndicator color={this.state.threadNotificationColor} />
            </HeaderButton>,
        );
        rightPanelPhaseButtons.set(
            RightPanelPhases.NotificationPanel,
            <HeaderButton
                key="notifsButton"
                name="notifsButton"
                title={_t("Notifications")}
                isHighlighted={this.isPhase(RightPanelPhases.NotificationPanel)}
                onClick={this.onNotificationsClicked}
                isUnread={this.globalNotificationState.color === NotificationColor.Red}
            >
                {this.globalNotificationState.color === NotificationColor.Red ? (
                    <UnreadIndicator color={this.globalNotificationState.color} />
                ) : null}
            </HeaderButton>,
        );
        rightPanelPhaseButtons.set(
            RightPanelPhases.RoomSummary,
            <HeaderButton
                key="roomSummaryButton"
                name="roomSummaryButton"
                title={_t("Room info")}
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
