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

import React, { FC, useState, useMemo, useCallback } from "react";
import classNames from "classnames";
import { throttle } from "lodash";
import { RoomStateEvent, ISearchResults } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import type { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import SettingsStore from "../../../settings/SettingsStore";
import RoomHeaderButtons from "../right_panel/LegacyRoomHeaderButtons";
import E2EIcon from "./E2EIcon";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import RoomTopic from "../elements/RoomTopic";
import RoomName from "../elements/RoomName";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import { RoomKnocksBar } from "./RoomKnocksBar";
import { SearchScope } from "./SearchBar";
import { aboveLeftOf, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import RoomContextMenu from "../context_menus/RoomContextMenu";
import { contextMenuBelow } from "./RoomTile";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import RoomContext from "../../../contexts/RoomContext";
import RoomLiveShareWarning from "../beacon/RoomLiveShareWarning";
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
import { useCall, useLayout } from "../../../hooks/useCall";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";
import { Call, ElementCall, Layout } from "../../../models/Call";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../context_menus/IconizedContextMenu";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { SessionDuration } from "../voip/CallDuration";
import RoomCallBanner from "../beacon/RoomCallBanner";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

class DisabledWithReason {
    public constructor(public readonly reason: string) {}
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
        } else {
            // behavior === "legacy_or_jitsi"
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    setBusy(true);
                    await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Voice);
                    setBusy(false);
                },
                disabled: false,
            };
        }
    }, [behavior, room, setBusy]);

    return (
        <AccessibleButton
            className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_voiceCallButton"
            onClick={onClick}
            aria-label={_t("voip|voice_call")}
            title={tooltip ?? _t("voip|voice_call")}
            placement="bottom"
            disabled={disabled || busy}
        />
    );
};

interface VideoCallButtonProps {
    room: Room;
    busy: boolean;
    setBusy: (value: boolean) => void;
    behavior: DisabledWithReason | "legacy_or_jitsi" | "element" | "jitsi_or_element" | "legacy_or_element";
}

/**
 * Button for starting video calls, supporting both legacy 1:1 calls, Jitsi
 * widgets, and native group calls. If multiple calling options are available,
 * this shows a menu to pick between them.
 */
const VideoCallButton: FC<VideoCallButtonProps> = ({ room, busy, setBusy, behavior }) => {
    const [menuOpen, buttonRef, openMenu, closeMenu] = useContextMenu();

    const startLegacyCall = useCallback(async (): Promise<void> => {
        setBusy(true);
        await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Video);
        setBusy(false);
    }, [setBusy, room]);

    const startElementCall = useCallback(
        (skipLobby: boolean) => {
            setBusy(true);
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
                skipLobby: skipLobby,
                metricsTrigger: undefined,
            });
            setBusy(false);
        },
        [setBusy, room],
    );

    const { onClick, tooltip, disabled } = useMemo(() => {
        if (behavior instanceof DisabledWithReason) {
            return {
                onClick: () => {},
                tooltip: behavior.reason,
                disabled: true,
            };
        } else if (behavior === "legacy_or_jitsi") {
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    await startLegacyCall();
                },
                disabled: false,
            };
        } else if (behavior === "element") {
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    startElementCall("shiftKey" in ev ? ev.shiftKey : false);
                },
                disabled: false,
            };
        } else {
            // behavior === "jitsi_or_element" | "legacy_or_element"
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    openMenu();
                },
                disabled: false,
            };
        }
    }, [behavior, startLegacyCall, startElementCall, openMenu]);

    const onJitsiClick = useCallback(
        async (ev: ButtonEvent): Promise<void> => {
            ev.preventDefault();
            closeMenu();
            await startLegacyCall();
        },
        [closeMenu, startLegacyCall],
    );

    const onElementClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            startElementCall("shiftKey" in ev ? ev.shiftKey : false);
        },
        [closeMenu, startElementCall],
    );

    let menu: JSX.Element | null = null;
    if (menuOpen) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        const brand = SdkConfig.get("element_call").brand;
        menu = (
            <IconizedContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu}>
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuOption
                        label={
                            behavior == "legacy_or_element"
                                ? _t("room|header|video_call_button_legacy")
                                : _t("room|header|video_call_button_jitsi")
                        }
                        onClick={onJitsiClick}
                    />
                    <IconizedContextMenuOption
                        label={_t("room|header|video_call_button_ec", { brand })}
                        onClick={onElementClick}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    return (
        <>
            <AccessibleButton
                ref={buttonRef}
                className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_videoCallButton"
                onClick={onClick}
                aria-label={_t("voip|video_call")}
                title={tooltip ?? _t("voip|video_call")}
                placement="bottom"
                disabled={disabled || busy}
            />
            {menu}
        </>
    );
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
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively;
    }, []);

    const hasLegacyCall = useEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.CallsChanged,
        useCallback(() => LegacyCallHandler.instance.getCallForRoom(room.roomId) !== null, [room]),
    );

    const widgets = useWidgets(room);
    const hasJitsiWidget = useMemo(() => widgets.some((widget) => WidgetType.JITSI.matches(widget.type)), [widgets]);

    const hasGroupCall = useCall(room.roomId) !== null;

    const [functionalMembers, mayEditWidgets, mayCreateElementCalls] = useTypedEventEmitterState(
        room,
        RoomStateEvent.Update,
        useCallback(
            () => [
                getJoinedNonFunctionalMembers(room),
                room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
                room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, room.client),
            ],
            [room],
        ),
    );

    const makeVoiceCallButton = (behavior: VoiceCallButtonProps["behavior"]): JSX.Element => (
        <VoiceCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />
    );
    const makeVideoCallButton = (behavior: VideoCallButtonProps["behavior"]): JSX.Element => (
        <VideoCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />
    );

    if (isVideoRoom || !showButtons) {
        return null;
    } else if (groupCallsEnabled) {
        if (useElementCallExclusively) {
            if (hasGroupCall) {
                return makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_ongoing_call")));
            } else if (mayCreateElementCalls) {
                return makeVideoCallButton("element");
            } else {
                return makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_no_perms_start_video_call")));
            }
        } else if (hasLegacyCall || hasJitsiWidget) {
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_ongoing_call")))}
                    {makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_ongoing_call")))}
                </>
            );
        } else if (functionalMembers.length <= 1) {
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_no_one_here")))}
                    {makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_no_one_here")))}
                </>
            );
        } else if (functionalMembers.length === 2) {
            return (
                <>
                    {makeVoiceCallButton("legacy_or_jitsi")}
                    {makeVideoCallButton("legacy_or_element")}
                </>
            );
        } else if (mayEditWidgets) {
            return (
                <>
                    {makeVoiceCallButton("legacy_or_jitsi")}
                    {makeVideoCallButton(mayCreateElementCalls ? "jitsi_or_element" : "legacy_or_jitsi")}
                </>
            );
        } else {
            const videoCallBehavior = mayCreateElementCalls
                ? "element"
                : new DisabledWithReason(_t("voip|disabled_no_perms_start_video_call"));
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_no_perms_start_voice_call")))}
                    {makeVideoCallButton(videoCallBehavior)}
                </>
            );
        }
    } else if (hasLegacyCall || hasJitsiWidget) {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_ongoing_call")))}
                {makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_ongoing_call")))}
            </>
        );
    } else if (functionalMembers.length <= 1) {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_no_one_here")))}
                {makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_no_one_here")))}
            </>
        );
    } else if (functionalMembers.length === 2 || mayEditWidgets) {
        return (
            <>
                {makeVoiceCallButton("legacy_or_jitsi")}
                {makeVideoCallButton("legacy_or_jitsi")}
            </>
        );
    } else {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("voip|disabled_no_perms_start_voice_call")))}
                {makeVideoCallButton(new DisabledWithReason(_t("voip|disabled_no_perms_start_video_call")))}
            </>
        );
    }
};

interface CallLayoutSelectorProps {
    call: ElementCall;
}

const CallLayoutSelector: FC<CallLayoutSelectorProps> = ({ call }) => {
    const layout = useLayout(call);
    const [menuOpen, buttonRef, openMenu, closeMenu] = useContextMenu();

    const onClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            openMenu();
        },
        [openMenu],
    );

    const onFreedomClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            call.setLayout(Layout.Tile);
        },
        [closeMenu, call],
    );

    const onSpotlightClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            call.setLayout(Layout.Spotlight);
        },
        [closeMenu, call],
    );

    let menu: JSX.Element | null = null;
    if (menuOpen) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        menu = (
            <IconizedContextMenu
                className="mx_LegacyRoomHeader_layoutMenu"
                {...aboveLeftOf(buttonRect)}
                onFinished={closeMenu}
            >
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuRadio
                        iconClassName="mx_LegacyRoomHeader_freedomIcon"
                        label={_t("room|header|video_call_ec_layout_freedom")}
                        active={layout === Layout.Tile}
                        onClick={onFreedomClick}
                    />
                    <IconizedContextMenuRadio
                        iconClassName="mx_LegacyRoomHeader_spotlightIcon"
                        label={_t("room|header|video_call_ec_layout_spotlight")}
                        active={layout === Layout.Spotlight}
                        onClick={onSpotlightClick}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    return (
        <>
            <AccessibleButton
                ref={buttonRef}
                className={classNames("mx_LegacyRoomHeader_button", {
                    "mx_LegacyRoomHeader_layoutButton--freedom": layout === Layout.Tile,
                    "mx_LegacyRoomHeader_layoutButton--spotlight": layout === Layout.Spotlight,
                })}
                onClick={onClick}
                title={_t("room|header|video_call_ec_change_layout")}
                placement="bottom"
                key="layout"
            />
            {menu}
        </>
    );
};

export interface ISearchInfo {
    searchId: number;
    roomId?: string;
    term: string;
    scope: SearchScope;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;

    inProgress?: boolean;
    count?: number;
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
    searchInfo?: ISearchInfo;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
    showButtons?: boolean;
    enableRoomOptionsMenu?: boolean;
    viewingCall: boolean;
    activeCall: Call | null;
    additionalButtons?: ViewRoomOpts["buttons"];
}

interface IState {
    contextMenuPosition?: DOMRect;
    rightPanelOpen: boolean;
    featureAskToJoin: boolean;
}

/**
 * @deprecated use `src/components/views/rooms/RoomHeader.tsx` instead
 */
export default class RoomHeader extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        inRoom: false,
        excludedRightPanelPhaseButtons: [],
        showButtons: true,
        enableRoomOptionsMenu: true,
    };

    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;
    private readonly client = this.props.room.client;
    private readonly featureAskToJoinWatcher: string;

    public constructor(props: IProps, context: IState) {
        super(props, context);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(props.room);
        notiStore.on(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.state = {
            rightPanelOpen: RightPanelStore.instance.isOpen,
            featureAskToJoin: SettingsStore.getValue("feature_ask_to_join"),
        };
        this.featureAskToJoinWatcher = SettingsStore.watchSetting(
            "feature_ask_to_join",
            null,
            (_settingName, _roomId, _atLevel, _newValAtLevel, featureAskToJoin) => {
                this.setState({ featureAskToJoin });
            },
        );
    }

    public componentDidMount(): void {
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    public componentWillUnmount(): void {
        this.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        notiStore.removeListener(NotificationStateEvents.Update, this.onNotificationUpdate);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        SettingsStore.unwatchSetting(this.featureAskToJoinWatcher);
    }

    private onRightPanelStoreUpdate = (): void => {
        this.setState({ rightPanelOpen: RightPanelStore.instance.isOpen });
    };

    private onRoomStateEvents = (event: MatrixEvent): void => {
        if (!this.props.room || event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        // redisplay the room name, topic, etc.
        this.rateLimitedUpdate();
    };

    private onNotificationUpdate = (): void => {
        this.forceUpdate();
    };

    private rateLimitedUpdate = throttle(
        () => {
            this.forceUpdate();
        },
        500,
        { leading: true, trailing: true },
    );

    private onContextMenuOpenClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenuCloseClick = (): void => {
        this.setState({ contextMenuPosition: undefined });
    };

    private onHideCallClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.props.room.roomId,
            view_call: false,
            metricsTrigger: undefined,
        });
    };

    private renderButtons(isVideoRoom: boolean): React.ReactNode {
        const startButtons: JSX.Element[] = [];

        if (!this.props.viewingCall && this.props.inRoom && !this.context.tombstone) {
            startButtons.push(<CallButtons key="calls" room={this.props.room} />);
        }

        if (this.props.viewingCall && this.props.activeCall instanceof ElementCall) {
            startButtons.push(<CallLayoutSelector key="layout" call={this.props.activeCall} />);
        }

        if (!this.props.viewingCall && this.props.onForgetClick) {
            startButtons.push(
                <AccessibleButton
                    className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_forgetButton"
                    onClick={this.props.onForgetClick}
                    title={_t("room|header|forget_room_button")}
                    placement="bottom"
                    key="forget"
                />,
            );
        }

        if (!this.props.viewingCall && this.props.onAppsClick) {
            startButtons.push(
                <AccessibleButton
                    className={classNames("mx_LegacyRoomHeader_button mx_LegacyRoomHeader_appsButton", {
                        mx_LegacyRoomHeader_appsButton_highlight: this.props.appsShown,
                    })}
                    onClick={this.props.onAppsClick}
                    title={
                        this.props.appsShown
                            ? _t("room|header|hide_widgets_button")
                            : _t("room|header|show_widgets_button")
                    }
                    aria-checked={this.props.appsShown}
                    placement="bottom"
                    key="apps"
                />,
            );
        }

        if (!this.props.viewingCall && this.props.onSearchClick && this.props.inRoom) {
            startButtons.push(
                <AccessibleButton
                    className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_searchButton"
                    onClick={this.props.onSearchClick}
                    title={_t("action|search")}
                    placement="bottom"
                    key="search"
                />,
            );
        }

        if (this.props.onInviteClick && (!this.props.viewingCall || isVideoRoom) && this.props.inRoom) {
            startButtons.push(
                <AccessibleButton
                    className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_inviteButton"
                    onClick={this.props.onInviteClick}
                    title={_t("action|invite")}
                    placement="bottom"
                    key="invite"
                />,
            );
        }

        const endButtons: JSX.Element[] = [];

        if (this.props.viewingCall && !isVideoRoom) {
            if (this.props.activeCall === null) {
                endButtons.push(
                    <AccessibleButton
                        className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_closeButton"
                        onClick={this.onHideCallClick}
                        title={_t("room|header|close_call_button")}
                        key="close"
                    />,
                );
            } else {
                endButtons.push(
                    <AccessibleButton
                        className="mx_LegacyRoomHeader_button mx_LegacyRoomHeader_minimiseButton"
                        onClick={this.onHideCallClick}
                        title={_t("room|header|video_room_view_chat_button")}
                        placement="bottom"
                        key="minimise"
                    />,
                );
            }
        }

        return (
            <>
                {this.props.additionalButtons?.map((props) => {
                    const label = props.label();

                    return (
                        <Tooltip label={label} key={props.id}>
                            <IconButton
                                onClick={() => {
                                    props.onClick();
                                    this.forceUpdate();
                                }}
                                title={label}
                            >
                                {typeof props.icon === "function" ? props.icon() : props.icon}
                            </IconButton>
                        </Tooltip>
                    );
                })}
                {startButtons}
                <RoomHeaderButtons
                    room={this.props.room}
                    excludedRightPanelPhaseButtons={this.props.excludedRightPanelPhaseButtons}
                />
                {endButtons}
            </>
        );
    }

    private renderName(oobName: string): JSX.Element {
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
            if (members.length === 1 && members[0].userId === this.client.credentials.userId) {
                const nameEvent = this.props.room.currentState.getStateEvents("m.room.name", "");
                if (!nameEvent || !nameEvent.getContent().name) {
                    settingsHint = true;
                }
            }
        }

        const textClasses = classNames("mx_LegacyRoomHeader_nametext", {
            mx_LegacyRoomHeader_settingsHint: settingsHint,
        });
        const roomName = (
            <RoomName room={this.props.room}>
                {(name) => {
                    const roomName = name || oobName;
                    return (
                        <div dir="auto" className={textClasses} title={roomName} role="heading" aria-level={1}>
                            {roomName}
                        </div>
                    );
                }}
            </RoomName>
        );

        if (this.props.enableRoomOptionsMenu && shouldShowComponent(UIComponent.RoomOptionsMenu)) {
            return (
                <ContextMenuTooltipButton
                    className="mx_LegacyRoomHeader_name"
                    onClick={this.onContextMenuOpenClick}
                    isExpanded={!!this.state.contextMenuPosition}
                    title={_t("room|context_menu|title")}
                    placement="bottom"
                >
                    {roomName}
                    {this.props.room && <div className="mx_LegacyRoomHeader_chevron" />}
                    {contextMenu}
                </ContextMenuTooltipButton>
            );
        }

        return <div className="mx_LegacyRoomHeader_name mx_LegacyRoomHeader_name--textonly">{roomName}</div>;
    }

    public render(): React.ReactNode {
        const isVideoRoom = SettingsStore.getValue("feature_video_rooms") && calcIsVideoRoom(this.props.room);

        let roomAvatar: JSX.Element | null = null;
        if (this.props.room) {
            roomAvatar = (
                <DecoratedRoomAvatar
                    room={this.props.room}
                    size="24px"
                    oobData={this.props.oobData}
                    viewAvatarOnClick={true}
                />
            );
        }

        const icon = this.props.viewingCall ? (
            <div className="mx_LegacyRoomHeader_icon mx_LegacyRoomHeader_icon_video" />
        ) : this.props.e2eStatus ? (
            <E2EIcon className="mx_LegacyRoomHeader_icon" status={this.props.e2eStatus} tooltipPlacement="bottom" />
        ) : // If we're expecting an E2EE status to come in, but it hasn't
        // yet been loaded, insert a blank div to reserve space
        this.client.isRoomEncrypted(this.props.room.roomId) && this.client.isCryptoEnabled() ? (
            <div className="mx_LegacyRoomHeader_icon" />
        ) : null;

        const buttons = this.props.showButtons ? this.renderButtons(isVideoRoom) : null;

        let oobName = _t("common|unnamed_room");
        if (this.props.oobData && this.props.oobData.name) {
            oobName = this.props.oobData.name;
        }

        const name = this.renderName(oobName);

        if (this.props.viewingCall && !isVideoRoom) {
            return (
                <header className="mx_LegacyRoomHeader light-panel">
                    <div
                        className="mx_LegacyRoomHeader_wrapper"
                        aria-owns={this.state.rightPanelOpen ? "mx_RightPanel" : undefined}
                    >
                        <div className="mx_LegacyRoomHeader_avatar">{roomAvatar}</div>
                        {icon}
                        {name}
                        {this.props.activeCall instanceof ElementCall && (
                            <SessionDuration session={this.props.activeCall?.session} />
                        )}
                        {/* Empty topic element to fill out space */}
                        <div className="mx_LegacyRoomHeader_topic" />
                        {buttons}
                    </div>
                </header>
            );
        }

        let searchStatus: JSX.Element | null = null;

        // don't display the search count until the search completes and
        // gives us a valid (possibly zero) searchCount.
        if (typeof this.props.searchInfo?.count === "number") {
            searchStatus = (
                <div className="mx_LegacyRoomHeader_searchStatus">
                    &nbsp;
                    {_t("room|search|result_count", { count: this.props.searchInfo.count })}
                </div>
            );
        }

        const topicElement = <RoomTopic room={this.props.room} className="mx_LegacyRoomHeader_topic" />;

        const viewLabs = (): void =>
            defaultDispatcher.dispatch({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Labs,
            });
        const betaPill = isVideoRoom ? (
            <BetaPill onClick={viewLabs} tooltipTitle={_t("labs|video_rooms_beta")} />
        ) : null;

        return (
            <header className="mx_LegacyRoomHeader light-panel">
                <div
                    className="mx_LegacyRoomHeader_wrapper"
                    aria-owns={this.state.rightPanelOpen ? "mx_RightPanel" : undefined}
                >
                    <div className="mx_LegacyRoomHeader_avatar">{roomAvatar}</div>
                    {icon}
                    {name}
                    {searchStatus}
                    {topicElement}
                    {betaPill}
                    {buttons}
                </div>
                {!isVideoRoom && <RoomCallBanner roomId={this.props.room.roomId} />}
                <RoomLiveShareWarning roomId={this.props.room.roomId} />
                {this.state.featureAskToJoin && <RoomKnocksBar room={this.props.room} />}
            </header>
        );
    }
}
