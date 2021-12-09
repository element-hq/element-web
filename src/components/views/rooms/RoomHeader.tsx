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
import { MatrixEvent, Room, RoomState } from 'matrix-js-sdk/src';
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import SettingsStore from "../../../settings/SettingsStore";
import RoomHeaderButtons from '../right_panel/RoomHeaderButtons';
import E2EIcon from './E2EIcon';
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import RoomTopic from "../elements/RoomTopic";
import RoomName from "../elements/RoomName";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { E2EStatus } from '../../../utils/ShieldUtils';
import { IOOBData } from '../../../stores/ThreepidInviteStore';
import { SearchScope } from './SearchBar';
import { ContextMenuTooltipButton } from '../../structures/ContextMenu';
import RoomContextMenu from "../context_menus/RoomContextMenu";
import { contextMenuBelow } from './RoomTile';
import { RoomNotificationStateStore } from '../../../stores/notifications/RoomNotificationStateStore';
import { RightPanelPhases } from '../../../stores/RightPanelStorePhases';
import { NotificationStateEvents } from '../../../stores/notifications/NotificationState';

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
    onForgetClick: () => void;
    onCallPlaced: (type: CallType) => void;
    onAppsClick: () => void;
    e2eStatus: E2EStatus;
    appsShown: boolean;
    searchInfo: ISearchInfo;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
}

interface IState {
    contextMenuPosition?: DOMRect;
}

@replaceableComponent("views.rooms.RoomHeader")
export default class RoomHeader extends React.Component<IProps, IState> {
    static defaultProps = {
        editing: false,
        inRoom: false,
        excludedRightPanelPhaseButtons: [],
    };

    constructor(props, context) {
        super(props, context);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(props.room);
        notiStore.on(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.state = {};
    }

    public componentDidMount() {
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.events", this.onRoomStateEvents);
    }

    public componentWillUnmount() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.events", this.onRoomStateEvents);
        }
        const notiStore = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        notiStore.removeListener(NotificationStateEvents.Update, this.onNotificationUpdate);
    }

    private onRoomStateEvents = (event: MatrixEvent, state: RoomState) => {
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

        let oobName = _t("Join Room");
        if (this.props.oobData && this.props.oobData.name) {
            oobName = this.props.oobData.name;
        }

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

        const textClasses = classNames('mx_RoomHeader_nametext', { mx_RoomHeader_settingsHint: settingsHint });
        const name = (
            <ContextMenuTooltipButton
                className="mx_RoomHeader_name"
                onClick={this.onContextMenuOpenClick}
                isExpanded={!!this.state.contextMenuPosition}
                title={_t("Room options")}
            >
                <RoomName room={this.props.room}>
                    { (name) => {
                        const roomName = name || oobName;
                        return <div dir="auto" className={textClasses} title={roomName}>{ roomName }</div>;
                    } }
                </RoomName>
                { this.props.room && <div className="mx_RoomHeader_chevron" /> }
                { contextMenu }
            </ContextMenuTooltipButton>
        );

        const topicElement = <RoomTopic room={this.props.room}>
            { (topic, ref) => <div className="mx_RoomHeader_topic" ref={ref} title={topic} dir="auto">
                { topic }
            </div> }
        </RoomTopic>;

        let roomAvatar;
        if (this.props.room) {
            roomAvatar = <DecoratedRoomAvatar
                room={this.props.room}
                avatarSize={24}
                oobData={this.props.oobData}
                viewAvatarOnClick={true}
            />;
        }

        const buttons: JSX.Element[] = [];

        if (this.props.inRoom && SettingsStore.getValue("showCallButtonsInComposer")) {
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

        const rightRow =
            <div className="mx_RoomHeader_buttons">
                { buttons }
            </div>;

        const e2eIcon = this.props.e2eStatus ? <E2EIcon status={this.props.e2eStatus} /> : undefined;

        return (
            <div className="mx_RoomHeader light-panel">
                <div className="mx_RoomHeader_wrapper" aria-owns="mx_RightPanel">
                    <div className="mx_RoomHeader_avatar">{ roomAvatar }</div>
                    <div className="mx_RoomHeader_e2eIcon">{ e2eIcon }</div>
                    { name }
                    { searchStatus }
                    { topicElement }
                    { rightRow }
                    <RoomHeaderButtons room={this.props.room} excludedRightPanelPhaseButtons={this.props.excludedRightPanelPhaseButtons} />
                </div>
            </div>
        );
    }
}
