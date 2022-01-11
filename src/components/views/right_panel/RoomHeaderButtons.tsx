/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from '../../../languageHandler';
import HeaderButton from './HeaderButton';
import HeaderButtons, { HeaderKind } from './HeaderButtons';
import { RightPanelPhases } from '../../../stores/right-panel/RightPanelStorePhases';
import { Action } from "../../../dispatcher/actions";
import { ActionPayload } from "../../../dispatcher/payloads";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { useSettingValue } from "../../../hooks/useSettings";
import { useReadPinnedEvents, usePinnedEvents } from './PinnedMessagesCard';
import { showThreadPanel } from "../../../dispatcher/dispatch-actions/threads";
import SettingsStore from "../../../settings/SettingsStore";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { ThreadsRoomNotificationState } from "../../../stores/notifications/ThreadsRoomNotificationState";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";

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

const UnreadIndicator = ({ color }: IUnreadIndicatorProps) => {
    if (color === NotificationColor.None) {
        return null;
    }

    const classes = classNames({
        "mx_RightPanel_headerButton_unreadIndicator": true,
        "mx_Indicator_gray": color === NotificationColor.Grey,
    });
    return <>
        <div className="mx_RightPanel_headerButton_unreadIndicator_bg" />
        <div className={classes} />
    </>;
};

interface IHeaderButtonProps {
    room: Room;
    isHighlighted: boolean;
    onClick: () => void;
}

const PinnedMessagesHeaderButton = ({ room, isHighlighted, onClick }: IHeaderButtonProps) => {
    const pinningEnabled = useSettingValue("feature_pinning");
    const pinnedEvents = usePinnedEvents(pinningEnabled && room);
    const readPinnedEvents = useReadPinnedEvents(pinningEnabled && room);
    if (!pinningEnabled) return null;

    let unreadIndicator;
    if (pinnedEvents.some(id => !readPinnedEvents.has(id))) {
        unreadIndicator = <UnreadIndicator />;
    }

    return <HeaderButton
        name="pinnedMessagesButton"
        title={_t("Pinned messages")}
        isHighlighted={isHighlighted}
        onClick={onClick}
        analytics={["Right Panel", "Pinned Messages Button", "click"]}
    >
        { unreadIndicator }
    </HeaderButton>;
};

const TimelineCardHeaderButton = ({ room, isHighlighted, onClick }: IHeaderButtonProps) => {
    let unreadIndicator;
    const color = RoomNotificationStateStore.instance.getRoomState(room).color;
    switch (color) {
        case NotificationColor.Grey:
        case NotificationColor.Red:
            unreadIndicator = <UnreadIndicator color={color} />;
    }
    return <HeaderButton
        name="timelineCardButton"
        title={_t("Chat")}
        isHighlighted={isHighlighted}
        onClick={onClick}
        analytics={["Right Panel", "Timeline Panel Button", "click"]}
    >
        { unreadIndicator }
    </HeaderButton>;
};

interface IProps {
    room?: Room;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
}

@replaceableComponent("views.right_panel.RoomHeaderButtons")
export default class RoomHeaderButtons extends HeaderButtons<IProps> {
    private static readonly THREAD_PHASES = [
        RightPanelPhases.ThreadPanel,
        RightPanelPhases.ThreadView,
    ];
    private threadNotificationState: ThreadsRoomNotificationState;

    constructor(props: IProps) {
        super(props, HeaderKind.Room);

        this.threadNotificationState = RoomNotificationStateStore.instance.getThreadsRoomState(this.props.room);
    }

    public componentDidMount(): void {
        super.componentDidMount();
        this.threadNotificationState.on(NotificationStateEvents.Update, this.onThreadNotification);
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount();
        this.threadNotificationState.off(NotificationStateEvents.Update, this.onThreadNotification);
    }

    private onThreadNotification = (): void => {
        this.setState({
            threadNotificationColor: this.threadNotificationState.color,
        });
    };

    protected onAction(payload: ActionPayload) {
        if (payload.action === Action.ViewUser) {
            if (payload.member) {
                if (payload.push) {
                    RightPanelStore.instance.pushCard(
                        { phase: RightPanelPhases.RoomMemberInfo, state: { member: payload.member } },
                    );
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

    private onRoomSummaryClicked = () => {
        // use roomPanelPhase rather than this.state.phase as it remembers the latest one if we close
        const currentPhase = RightPanelStore.instance.currentCard.phase;
        if (ROOM_INFO_PHASES.includes(currentPhase)) {
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

    private onNotificationsClicked = () => {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.NotificationPanel);
    };

    private onPinnedMessagesClicked = () => {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.PinnedMessages);
    };
    private onTimelineCardClicked = () => {
        this.setPhase(RightPanelPhases.Timeline);
    };

    private onThreadsPanelClicked = () => {
        if (RoomHeaderButtons.THREAD_PHASES.includes(this.state.phase)) {
            RightPanelStore.instance.togglePanel();
        } else {
            showThreadPanel();
        }
    };

    public renderButtons() {
        const rightPanelPhaseButtons: Map<RightPanelPhases, any> = new Map();

        rightPanelPhaseButtons.set(RightPanelPhases.PinnedMessages,
            <PinnedMessagesHeaderButton
                key="pinnedMessagesButton"
                room={this.props.room}
                isHighlighted={this.isPhase(RightPanelPhases.PinnedMessages)}
                onClick={this.onPinnedMessagesClicked} />,
        );
        rightPanelPhaseButtons.set(RightPanelPhases.Timeline,
            <TimelineCardHeaderButton
                key="timelineButton"
                room={this.props.room}
                isHighlighted={this.isPhase(RightPanelPhases.Timeline)}
                onClick={this.onTimelineCardClicked} />,
        );
        rightPanelPhaseButtons.set(RightPanelPhases.ThreadPanel,
            SettingsStore.getValue("feature_thread")
                ? <HeaderButton
                    key={RightPanelPhases.ThreadPanel}
                    name="threadsButton"
                    title={_t("Threads")}
                    onClick={this.onThreadsPanelClicked}
                    isHighlighted={this.isPhase(RoomHeaderButtons.THREAD_PHASES)}
                    analytics={['Right Panel', 'Threads List Button', 'click']}>
                    <UnreadIndicator color={this.threadNotificationState.color} />
                </HeaderButton>
                : null,
        );
        rightPanelPhaseButtons.set(RightPanelPhases.NotificationPanel,
            <HeaderButton
                key="notifsButton"
                name="notifsButton"
                title={_t('Notifications')}
                isHighlighted={this.isPhase(RightPanelPhases.NotificationPanel)}
                onClick={this.onNotificationsClicked}
                analytics={['Right Panel', 'Notification List Button', 'click']} />,
        );
        rightPanelPhaseButtons.set(RightPanelPhases.RoomSummary,
            <HeaderButton
                key="roomSummaryButton"
                name="roomSummaryButton"
                title={_t('Room Info')}
                isHighlighted={this.isPhase(ROOM_INFO_PHASES)}
                onClick={this.onRoomSummaryClicked}
                analytics={['Right Panel', 'Room Summary Button', 'click']} />,
        );

        return <>
            {
                Array.from(rightPanelPhaseButtons.keys()).map((phase) =>
                    (this.props.excludedRightPanelPhaseButtons.includes(phase)
                        ? null
                        : rightPanelPhaseButtons.get(phase)))
            }
        </>;
    }
}
