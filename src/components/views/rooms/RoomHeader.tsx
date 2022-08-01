/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import classNames from 'classnames';
import { throttle } from 'lodash';
import { MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk/src/matrix';
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import SettingsStore from "../../../settings/SettingsStore";
import RoomHeaderButtons from '../right_panel/RoomHeaderButtons';
import E2EIcon from './E2EIcon';
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import RoomTopic from "../elements/RoomTopic";
import RoomName from "../elements/RoomName";
import { E2EStatus } from '../../../utils/ShieldUtils';
import { IOOBData } from '../../../stores/ThreepidInviteStore';
import { SearchScope } from './SearchBar';
import { ContextMenuTooltipButton } from '../../structures/ContextMenu';
import RoomContextMenu from "../context_menus/RoomContextMenu";
import { contextMenuBelow } from './RoomTile';
import { RoomNotificationStateStore } from '../../../stores/notifications/RoomNotificationStateStore';
import { RightPanelPhases } from '../../../stores/right-panel/RightPanelStorePhases';
import { NotificationStateEvents } from '../../../stores/notifications/NotificationState';
import RoomContext from "../../../contexts/RoomContext";
import RoomLiveShareWarning from '../beacon/RoomLiveShareWarning';
import { BetaPill } from "../beta/BetaCard";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";

export interface ISearchInfo {
    searchTerm: string;
    searchScope: SearchScope;
    searchCount: number;
}

interface IProps {
    room: Room;
    oobData?: IOOBData;
    inRoom: boolean;
    onSearchClick: () => void;
    onInviteClick: () => void;
    onForgetClick: () => void;
    onCallPlaced: (type: CallType) => void;
    onAppsClick: () => void;
    e2eStatus: E2EStatus;
    appsShown: boolean;
    searchInfo: ISearchInfo;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
    showButtons?: boolean;
    enableRoomOptionsMenu?: boolean;
}

interface IState {
    contextMenuPosition?: DOMRect;
    rightPanelOpen: boolean;
}

export default class RoomHeader extends React.Component<IProps, IState> {
    static defaultProps = {
        editing: false,
        inRoom: false,
        excludedRightPanelPhaseButtons: [],
        showButtons: true,
        enableRoomOptionsMenu: true,
    };

    static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    constructor(props, context) {
        super(props, context);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(props.room);
        notiStore.on(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.state = {
            rightPanelOpen: RightPanelStore.instance.isOpen,
        };
    }

    public componentDidMount() {
        const cli = MatrixClientPeg.get();
        cli.on(RoomStateEvent.Events, this.onRoomStateEvents);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    public componentWillUnmount() {
        const cli = MatrixClientPeg.get();
        cli?.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        notiStore.removeListener(NotificationStateEvents.Update, this.onNotificationUpdate);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    private onRightPanelStoreUpdate = () => {
        this.setState({ rightPanelOpen: RightPanelStore.instance.isOpen });
    };

    private onRoomStateEvents = (event: MatrixEvent) => {
        if (!this.props.room || event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        // redisplay the room name, topic, etc.
        this.rateLimitedUpdate();
    };

    private onNotificationUpdate = () => {
        this.forceUpdate();
    };

    private rateLimitedUpdate = throttle(() => {
        this.forceUpdate();
    }, 500, { leading: true, trailing: true });

    private onContextMenuOpenClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenuCloseClick = () => {
        this.setState({ contextMenuPosition: null });
    };

    private renderButtons(): JSX.Element[] {
        const buttons: JSX.Element[] = [];

        if (this.props.inRoom &&
            this.props.onCallPlaced &&
            !this.context.tombstone &&
            SettingsStore.getValue("showCallButtonsInComposer")
        ) {
            const voiceCallButton = <AccessibleTooltipButton
                className="mx_RoomHeader_button mx_RoomHeader_voiceCallButton"
                onClick={() => this.props.onCallPlaced(CallType.Voice)}
                title={_t("Voice call")}
                key="voice"
            />;
            const videoCallButton = <AccessibleTooltipButton
                className="mx_RoomHeader_button mx_RoomHeader_videoCallButton"
                onClick={() => this.props.onCallPlaced(CallType.Video)}
                title={_t("Video call")}
                key="video"
            />;
            buttons.push(voiceCallButton, videoCallButton);
        }

        if (this.props.onForgetClick) {
            const forgetButton = <AccessibleTooltipButton
                className="mx_RoomHeader_button mx_RoomHeader_forgetButton"
                onClick={this.props.onForgetClick}
                title={_t("Forget room")}
                key="forget"
            />;
            buttons.push(forgetButton);
        }

        if (this.props.onAppsClick) {
            const appsButton = <AccessibleTooltipButton
                className={classNames("mx_RoomHeader_button mx_RoomHeader_appsButton", {
                    mx_RoomHeader_appsButton_highlight: this.props.appsShown,
                })}
                onClick={this.props.onAppsClick}
                title={this.props.appsShown ? _t("Hide Widgets") : _t("Show Widgets")}
                key="apps"
            />;
            buttons.push(appsButton);
        }

        if (this.props.onSearchClick && this.props.inRoom) {
            const searchButton = <AccessibleTooltipButton
                className="mx_RoomHeader_button mx_RoomHeader_searchButton"
                onClick={this.props.onSearchClick}
                title={_t("Search")}
                key="search"
            />;
            buttons.push(searchButton);
        }

        if (this.props.onInviteClick && this.props.inRoom) {
            const inviteButton = <AccessibleTooltipButton
                className="mx_RoomHeader_button mx_RoomHeader_inviteButton"
                onClick={this.props.onInviteClick}
                title={_t("Invite")}
                key="invite"
            />;
            buttons.push(inviteButton);
        }

        return buttons;
    }

    private renderName(oobName) {
        let contextMenu: JSX.Element;
        if (this.state.contextMenuPosition && this.props.room) {
            contextMenu = (
                <RoomContextMenu
                    {...contextMenuBelow(this.state.contextMenuPosition)}
                    room={this.props.room}
                    onFinished={this.onContextMenuCloseClick}
                />
            );
        }

        // XXX: this is a bit inefficient - we could just compare room.name for 'Empty room'...
        let settingsHint = false;
        const members = this.props.room ? this.props.room.getJoinedMembers() : undefined;
        if (members) {
            if (members.length === 1 && members[0].userId === MatrixClientPeg.get().credentials.userId) {
                const nameEvent = this.props.room.currentState.getStateEvents('m.room.name', '');
                if (!nameEvent || !nameEvent.getContent().name) {
                    settingsHint = true;
                }
            }
        }

        const textClasses = classNames('mx_RoomHeader_nametext', { mx_RoomHeader_settingsHint: settingsHint });
        const roomName = <RoomName room={this.props.room}>
            { (name) => {
                const roomName = name || oobName;
                return <div dir="auto" className={textClasses} title={roomName} role="heading" aria-level={1}>
                    { roomName }
                </div>;
            } }
        </RoomName>;

        if (this.props.enableRoomOptionsMenu) {
            return (
                <ContextMenuTooltipButton
                    className="mx_RoomHeader_name"
                    onClick={this.onContextMenuOpenClick}
                    isExpanded={!!this.state.contextMenuPosition}
                    title={_t("Room options")}
                >
                    { roomName }
                    { this.props.room && <div className="mx_RoomHeader_chevron" /> }
                    { contextMenu }
                </ContextMenuTooltipButton>
            );
        }

        return <div className="mx_RoomHeader_name mx_RoomHeader_name--textonly">
            { roomName }
        </div>;
    }

    public render() {
        let searchStatus = null;

        // don't display the search count until the search completes and
        // gives us a valid (possibly zero) searchCount.
        if (this.props.searchInfo &&
            this.props.searchInfo.searchCount !== undefined &&
            this.props.searchInfo.searchCount !== null) {
            searchStatus = <div className="mx_RoomHeader_searchStatus">&nbsp;
                { _t("(~%(count)s results)", { count: this.props.searchInfo.searchCount }) }
            </div>;
        }

        let oobName = _t("Join Room");
        if (this.props.oobData && this.props.oobData.name) {
            oobName = this.props.oobData.name;
        }

        const name = this.renderName(oobName);

        const topicElement = <RoomTopic
            room={this.props.room}
            className="mx_RoomHeader_topic"
        />;

        let roomAvatar;
        if (this.props.room) {
            roomAvatar = <DecoratedRoomAvatar
                room={this.props.room}
                avatarSize={24}
                oobData={this.props.oobData}
                viewAvatarOnClick={true}
            />;
        }

        let buttons;
        if (this.props.showButtons) {
            buttons = <React.Fragment>
                <div className="mx_RoomHeader_buttons">
                    { this.renderButtons() }
                </div>
                <RoomHeaderButtons room={this.props.room} excludedRightPanelPhaseButtons={this.props.excludedRightPanelPhaseButtons} />
            </React.Fragment>;
        }

        const e2eIcon = this.props.e2eStatus ? <E2EIcon status={this.props.e2eStatus} /> : undefined;

        const isVideoRoom = SettingsStore.getValue("feature_video_rooms") && this.props.room.isElementVideoRoom();
        const viewLabs = () => defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Labs,
        });
        const betaPill = isVideoRoom ? (
            <BetaPill onClick={viewLabs} tooltipTitle={_t("Video rooms are a beta feature")} />
        ) : null;

        return (
            <header className="mx_RoomHeader light-panel">
                <div
                    className="mx_RoomHeader_wrapper"
                    aria-owns={this.state.rightPanelOpen ? "mx_RightPanel" : undefined}
                >
                    <div className="mx_RoomHeader_avatar">{ roomAvatar }</div>
                    <div className="mx_RoomHeader_e2eIcon">{ e2eIcon }</div>
                    { name }
                    { searchStatus }
                    { topicElement }
                    { betaPill }
                    { buttons }
                </div>
                <RoomLiveShareWarning roomId={this.props.room.roomId} />
            </header>
        );
    }
}
