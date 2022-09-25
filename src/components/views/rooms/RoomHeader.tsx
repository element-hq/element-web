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

import React, { FC, useState, useMemo, useCallback } from 'react';
import classNames from 'classnames';
import { throttle } from 'lodash';
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { Room } from "matrix-js-sdk/src/models/room";
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import SettingsStore from "../../../settings/SettingsStore";
import RoomHeaderButtons from '../right_panel/RoomHeaderButtons';
import E2EIcon from './E2EIcon';
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { ButtonEvent } from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import RoomTopic from "../elements/RoomTopic";
import RoomName from "../elements/RoomName";
import { E2EStatus } from '../../../utils/ShieldUtils';
import { IOOBData } from '../../../stores/ThreepidInviteStore';
import { SearchScope } from './SearchBar';
import { aboveLeftOf, ContextMenuTooltipButton, useContextMenu } from '../../structures/ContextMenu';
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
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import { useFeatureEnabled, useSettingValue } from "../../../hooks/useSettings";
import SdkConfig from "../../../SdkConfig";
import { useEventEmitterState, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { useWidgets } from "../right_panel/RoomSummaryCard";
import { WidgetType } from "../../../widgets/WidgetType";
import { useCall } from "../../../hooks/useCall";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";
import { ElementCall } from "../../../models/Call";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

class DisabledWithReason {
    constructor(public readonly reason: string) { }
}

interface VoiceCallButtonProps {
    room: Room;
    busy: boolean;
    setBusy: (value: boolean) => void;
    behavior: DisabledWithReason | "legacy_or_jitsi";
}

/**
 * Button for starting voice calls, supporting only legacy 1:1 calls and Jitsi
 * widgets.
 */
const VoiceCallButton: FC<VoiceCallButtonProps> = ({ room, busy, setBusy, behavior }) => {
    const { onClick, tooltip, disabled } = useMemo(() => {
        if (behavior instanceof DisabledWithReason) {
            return {
                onClick: () => {},
                tooltip: behavior.reason,
                disabled: true,
            };
        } else { // behavior === "legacy_or_jitsi"
            return {
                onClick: async (ev: ButtonEvent) => {
                    ev.preventDefault();
                    setBusy(true);
                    await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Voice);
                    setBusy(false);
                },
                disabled: false,
            };
        }
    }, [behavior, room, setBusy]);

    return <AccessibleTooltipButton
        className="mx_RoomHeader_button mx_RoomHeader_voiceCallButton"
        onClick={onClick}
        title={_t("Voice call")}
        tooltip={tooltip ?? _t("Voice call")}
        disabled={disabled || busy}
    />;
};

interface VideoCallButtonProps {
    room: Room;
    busy: boolean;
    setBusy: (value: boolean) => void;
    behavior: DisabledWithReason | "legacy_or_jitsi" | "element" | "jitsi_or_element";
}

/**
 * Button for starting video calls, supporting both legacy 1:1 calls, Jitsi
 * widgets, and native group calls. If multiple calling options are available,
 * this shows a menu to pick between them.
 */
const VideoCallButton: FC<VideoCallButtonProps> = ({ room, busy, setBusy, behavior }) => {
    const [menuOpen, buttonRef, openMenu, closeMenu] = useContextMenu();

    const startLegacyCall = useCallback(async () => {
        setBusy(true);
        await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Video);
        setBusy(false);
    }, [setBusy, room]);

    const startElementCall = useCallback(() => {
        setBusy(true);
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
            metricsTrigger: undefined,
        });
        setBusy(false);
    }, [setBusy, room]);

    const { onClick, tooltip, disabled } = useMemo(() => {
        if (behavior instanceof DisabledWithReason) {
            return {
                onClick: () => {},
                tooltip: behavior.reason,
                disabled: true,
            };
        } else if (behavior === "legacy_or_jitsi") {
            return {
                onClick: async (ev: ButtonEvent) => {
                    ev.preventDefault();
                    await startLegacyCall();
                },
                disabled: false,
            };
        } else if (behavior === "element") {
            return {
                onClick: async (ev: ButtonEvent) => {
                    ev.preventDefault();
                    startElementCall();
                },
                disabled: false,
            };
        } else { // behavior === "jitsi_or_element"
            return {
                onClick: async (ev: ButtonEvent) => {
                    ev.preventDefault();
                    openMenu();
                },
                disabled: false,
            };
        }
    }, [behavior, startLegacyCall, startElementCall, openMenu]);

    const onJitsiClick = useCallback(async (ev: ButtonEvent) => {
        ev.preventDefault();
        closeMenu();
        await startLegacyCall();
    }, [closeMenu, startLegacyCall]);

    const onElementClick = useCallback((ev: ButtonEvent) => {
        ev.preventDefault();
        closeMenu();
        startElementCall();
    }, [closeMenu, startElementCall]);

    let menu: JSX.Element | null = null;
    if (menuOpen) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        menu = <IconizedContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu}>
            <IconizedContextMenuOptionList>
                <IconizedContextMenuOption label={_t("Video call (Jitsi)")} onClick={onJitsiClick} />
                <IconizedContextMenuOption label={_t("Video call (Element Call)")} onClick={onElementClick} />
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    return <>
        <AccessibleTooltipButton
            inputRef={buttonRef}
            className="mx_RoomHeader_button mx_RoomHeader_videoCallButton"
            onClick={onClick}
            title={_t("Video call")}
            tooltip={tooltip ?? _t("Video call")}
            disabled={disabled || busy}
        />
        { menu }
    </>;
};

interface CallButtonsProps {
    room: Room;
}

// The header buttons for placing calls have become stupidly complex, so here
// they are as a separate component
const CallButtons: FC<CallButtonsProps> = ({ room }) => {
    const [busy, setBusy] = useState(false);
    const showButtons = useSettingValue<boolean>("showCallButtonsInComposer");
    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const isVideoRoom = useMemo(() => videoRoomsEnabled && calcIsVideoRoom(room), [videoRoomsEnabled, room]);
    const useElementCallExclusively = useMemo(() => SdkConfig.get("element_call").use_exclusively, []);

    const hasLegacyCall = useEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.CallsChanged,
        useCallback(() => LegacyCallHandler.instance.getCallForRoom(room.roomId) !== null, [room]),
    );

    const widgets = useWidgets(room);
    const hasJitsiWidget = useMemo(() => widgets.some(widget => WidgetType.JITSI.matches(widget.type)), [widgets]);

    const hasGroupCall = useCall(room.roomId) !== null;

    const [functionalMembers, mayEditWidgets, mayCreateElementCalls] = useTypedEventEmitterState(
        room,
        RoomStateEvent.Update,
        useCallback(() => [
            getJoinedNonFunctionalMembers(room),
            room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
            room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, room.client),
        ], [room]),
    );

    const makeVoiceCallButton = (behavior: VoiceCallButtonProps["behavior"]): JSX.Element =>
        <VoiceCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />;
    const makeVideoCallButton = (behavior: VideoCallButtonProps["behavior"]): JSX.Element =>
        <VideoCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />;

    if (isVideoRoom || !showButtons) {
        return null;
    } else if (groupCallsEnabled) {
        if (useElementCallExclusively) {
            if (hasGroupCall) {
                return makeVideoCallButton(new DisabledWithReason(_t("Ongoing call")));
            } else if (mayCreateElementCalls) {
                return makeVideoCallButton("element");
            } else {
                return makeVideoCallButton(
                    new DisabledWithReason(_t("You do not have permission to start video calls")),
                );
            }
        } else if (hasLegacyCall || hasJitsiWidget || hasGroupCall) {
            return <>
                { makeVoiceCallButton(new DisabledWithReason(_t("Ongoing call"))) }
                { makeVideoCallButton(new DisabledWithReason(_t("Ongoing call"))) }
            </>;
        } else if (functionalMembers.length <= 1) {
            return <>
                { makeVoiceCallButton(new DisabledWithReason(_t("There's no one here to call"))) }
                { makeVideoCallButton(new DisabledWithReason(_t("There's no one here to call"))) }
            </>;
        } else if (functionalMembers.length === 2) {
            return <>
                { makeVoiceCallButton("legacy_or_jitsi") }
                { makeVideoCallButton("legacy_or_jitsi") }
            </>;
        } else if (mayEditWidgets) {
            return <>
                { makeVoiceCallButton("legacy_or_jitsi") }
                { makeVideoCallButton(mayCreateElementCalls ? "jitsi_or_element" : "legacy_or_jitsi") }
            </>;
        } else {
            const videoCallBehavior = mayCreateElementCalls
                ? "element"
                : new DisabledWithReason(_t("You do not have permission to start video calls"));
            return <>
                { makeVoiceCallButton(new DisabledWithReason(_t("You do not have permission to start voice calls"))) }
                { makeVideoCallButton(videoCallBehavior) }
            </>;
        }
    } else if (hasLegacyCall || hasJitsiWidget) {
        return <>
            { makeVoiceCallButton(new DisabledWithReason(_t("Ongoing call"))) }
            { makeVideoCallButton(new DisabledWithReason(_t("Ongoing call"))) }
        </>;
    } else if (functionalMembers.length <= 1) {
        return <>
            { makeVoiceCallButton(new DisabledWithReason(_t("There's no one here to call"))) }
            { makeVideoCallButton(new DisabledWithReason(_t("There's no one here to call"))) }
        </>;
    } else if (functionalMembers.length === 2 || mayEditWidgets) {
        return <>
            { makeVoiceCallButton("legacy_or_jitsi") }
            { makeVideoCallButton("legacy_or_jitsi") }
        </>;
    } else {
        return <>
            { makeVoiceCallButton(new DisabledWithReason(_t("You do not have permission to start voice calls"))) }
            { makeVideoCallButton(new DisabledWithReason(_t("You do not have permission to start video calls"))) }
        </>;
    }
};

export interface ISearchInfo {
    searchTerm: string;
    searchScope: SearchScope;
    searchCount: number;
}

export interface IProps {
    room: Room;
    oobData?: IOOBData;
    inRoom: boolean;
    onSearchClick: (() => void) | null;
    onInviteClick: (() => void) | null;
    onForgetClick: (() => void) | null;
    onAppsClick: (() => void) | null;
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

    constructor(props: IProps, context: IState) {
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
        this.setState({ contextMenuPosition: undefined });
    };

    private renderButtons(): JSX.Element[] {
        const buttons: JSX.Element[] = [];

        if (this.props.inRoom && !this.context.tombstone) {
            buttons.push(<CallButtons key="calls" room={this.props.room} />);
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

    private renderName(oobName: string) {
        let contextMenu: JSX.Element | null = null;
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
        let searchStatus: JSX.Element | null = null;

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

        let roomAvatar: JSX.Element | null = null;
        if (this.props.room) {
            roomAvatar = <DecoratedRoomAvatar
                room={this.props.room}
                avatarSize={24}
                oobData={this.props.oobData}
                viewAvatarOnClick={true}
            />;
        }

        let buttons: JSX.Element | null = null;
        if (this.props.showButtons) {
            buttons = <React.Fragment>
                <div className="mx_RoomHeader_buttons">
                    { this.renderButtons() }
                </div>
                <RoomHeaderButtons room={this.props.room} excludedRightPanelPhaseButtons={this.props.excludedRightPanelPhaseButtons} />
            </React.Fragment>;
        }

        const e2eIcon = this.props.e2eStatus ? <E2EIcon status={this.props.e2eStatus} /> : undefined;

        const isVideoRoom = SettingsStore.getValue("feature_video_rooms") && calcIsVideoRoom(this.props.room);
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
