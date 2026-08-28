/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { RoomEvent, type Room, RoomStateEvent, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import ImagePackIcon from "@vector-im/compound-design-tokens/assets/web/icons/image";
import {
    ImagePacksSettings,
    useImagePacks,
    type UseImagePacksOptions,
} from "@element-hq/element-web-module-image-packs";
import { createWritersFromClient, runAccountDataTransaction, uploadImageFromClient } from "../../../custom-emotes";
import { mediaFromMxc } from "../../../customisations/Media";
import {
    AdminIcon,
    GroupIcon,
    LockIcon,
    PollsIcon,
    SettingsIcon,
    VoiceCallIcon,
    NotificationsIcon,
    AdvancedSettingsIcon,
    TreeIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import TabbedView, { Tab } from "../../structures/TabbedView";
import { _t, _td } from "../../../languageHandler";
import AdvancedRoomSettingsTab from "../settings/tabs/room/AdvancedRoomSettingsTab";
import RolesRoomSettingsTab from "../settings/tabs/room/RolesRoomSettingsTab";
import GeneralRoomSettingsTab from "../settings/tabs/room/GeneralRoomSettingsTab";
import SecurityRoomSettingsTab from "../settings/tabs/room/SecurityRoomSettingsTab";
import NotificationSettingsTab from "../settings/tabs/room/NotificationSettingsTab";
import BridgeSettingsTab from "../settings/tabs/room/BridgeSettingsTab";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import { Action } from "../../../dispatcher/actions";
import { VoipRoomSettingsTab } from "../settings/tabs/room/VoipRoomSettingsTab";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { type NonEmptyArray } from "../../../@types/common";
import { PollHistoryTab } from "../settings/tabs/room/PollHistoryTab";
import ErrorBoundary from "../elements/ErrorBoundary";
import { PeopleRoomSettingsTab } from "../settings/tabs/room/PeopleRoomSettingsTab";
import { SDKContext } from "../../../contexts/SDKContext";
import { type SDKContextClass } from "../../../contexts/SDKContextClass";
import { RoomSettingsTab } from "./RoomSettingsDialog-tab.ts";
import SdkConfig from "../../../SdkConfig";
import { ModuleApi } from "../../../modules/Api";

interface IProps {
    roomId: string;
    onFinished: (success?: boolean) => void;
    initialTabId?: RoomSettingsTab;
    sdkContext: SDKContextClass;
}

interface IState {
    room: Room;
    activeTabId: RoomSettingsTab;
}

/**
 * Room-scoped image packs section. The module exports the body component
 * and the data hook; we wire the live `MatrixClient` to the `PackWriters`
 * contract here via `createWritersFromClient` (defined in `custom-emotes.ts`).
 */
function ImagePacksRoomSettingsTab({ room }: { room: Room }): React.ReactElement {
    const cli = MatrixClientPeg.safeGet();
    const options: UseImagePacksOptions = {
        client: {
            getUserId: () => cli.getUserId(),
            getRoom: (id: string) => cli.getRoom(id),
            getAccountData: (type: string) => {
                const ev = cli.getAccountData(type as never);
                return ev ? { getContent: () => ev.getContent() } : null;
            },
            setAccountData: (type: string, content: unknown) => cli.setAccountData(type as never, content as never),
            runAccountDataTransaction: (callback) => runAccountDataTransaction(cli, callback),
        },
        getImageUrl: (mxcUrl, width, height) =>
            mediaFromMxc(mxcUrl, cli).getThumbnailOfSourceHttp(width, height, "scale") ?? undefined,
        uploadImage: (file) => uploadImageFromClient(cli, file),
        writers: createWritersFromClient(cli),
        room,
    };
    const mount = ModuleApi.instance.customisations.imagePacksMount;
    return mount ? (
        <>{mount({ ...options, roomId: room.roomId })}</>
    ) : (
        <DirectImagePacksRoomSettings options={options} roomId={room.roomId} />
    );
}

function DirectImagePacksRoomSettings({
    options,
    roomId,
}: {
    options: UseImagePacksOptions;
    roomId: string;
}): React.ReactElement {
    const hook = useImagePacks(options);
    return <ImagePacksSettings api={hook} roomId={roomId} />;
}

class RoomSettingsDialog extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        const room = this.getRoom();
        this.state = { room, activeTabId: props.initialTabId || RoomSettingsTab.General };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.safeGet().on(RoomEvent.Name, this.onRoomName);
        MatrixClientPeg.safeGet().on(RoomStateEvent.Events, this.onStateEvent);
        this.onRoomName();
    }

    public componentDidUpdate(): void {
        if (this.props.roomId !== this.state.room.roomId) {
            const room = this.getRoom();
            this.setState({ room });
        }
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);

        MatrixClientPeg.get()?.removeListener(RoomEvent.Name, this.onRoomName);
        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onStateEvent);
    }

    /**
     * Get room from client
     * @returns Room
     * @throws when room is not found
     */
    private getRoom(): Room {
        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId)!;

        // something is really wrong if we encounter this
        if (!room) {
            throw new Error(`Cannot find room ${this.props.roomId}`);
        }
        return room;
    }

    private onAction = (payload: ActionPayload): void => {
        // When view changes below us, close the room settings
        // whilst the modal is open this can only be triggered when someone hits Leave Room
        if (payload.action === Action.ViewHomePage) {
            this.props.onFinished(true);
        }
    };

    private onRoomName = (): void => {
        // rerender when the room name changes
        this.forceUpdate();
    };

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() === EventType.RoomJoinRules) this.forceUpdate();
    };

    private onTabChange = (tabId: RoomSettingsTab): void => {
        this.setState({ activeTabId: tabId });
    };

    private getTabs(): NonEmptyArray<Tab<RoomSettingsTab>> {
        const tabs: Tab<RoomSettingsTab>[] = [];

        tabs.push(
            new Tab(
                RoomSettingsTab.General,
                _td("common|general"),
                <SettingsIcon />,
                <GeneralRoomSettingsTab room={this.state.room} />,
                "RoomSettingsGeneral",
            ),
        );
        if (SettingsStore.getValue("feature_ask_to_join") && this.state.room.getJoinRule() === "knock") {
            tabs.push(
                new Tab(
                    RoomSettingsTab.People,
                    _td("common|people"),
                    <GroupIcon />,
                    <PeopleRoomSettingsTab room={this.state.room} />,
                ),
            );
        }
        if (!SdkConfig.get("element_call").disable) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Voip,
                    _td("settings|voip|title"),
                    <VoiceCallIcon />,
                    <VoipRoomSettingsTab room={this.state.room} />,
                ),
            );
        }
        tabs.push(
            new Tab(
                RoomSettingsTab.Security,
                _td("room_settings|security|title"),
                <LockIcon />,
                <SecurityRoomSettingsTab room={this.state.room} closeSettingsFn={() => this.props.onFinished(true)} />,
                "RoomSettingsSecurityPrivacy",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Roles,
                _td("room_settings|permissions|title"),
                <AdminIcon />,
                <RolesRoomSettingsTab room={this.state.room} />,
                "RoomSettingsRolesPermissions",
            ),
        );
        tabs.push(
            new Tab(
                RoomSettingsTab.Notifications,
                _td("notifications|enable_prompt_toast_title"),
                <NotificationsIcon />,
                <NotificationSettingsTab
                    roomId={this.state.room.roomId}
                    closeSettingsFn={() => this.props.onFinished(true)}
                />,
                "RoomSettingsNotifications",
            ),
        );

        if (SettingsStore.getValue("feature_bridge_state")) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Bridges,
                    _td("room_settings|bridges|title"),
                    <TreeIcon />,
                    <BridgeSettingsTab room={this.state.room} />,
                    "RoomSettingsBridges",
                ),
            );
        }

        tabs.push(
            new Tab(
                RoomSettingsTab.PollHistory,
                _td("right_panel|polls_button"),
                <PollsIcon />,
                <PollHistoryTab room={this.state.room} onFinished={() => this.props.onFinished(true)} />,
            ),
        );

        tabs.push(
            new Tab(
                RoomSettingsTab.ImagePacks,
                _td("settings|image_packs|tab_title"),
                <ImagePackIcon />,
                <ImagePacksRoomSettingsTab room={this.state.room} />,
            ),
        );

        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            tabs.push(
                new Tab(
                    RoomSettingsTab.Advanced,
                    _td("common|advanced"),
                    <AdvancedSettingsIcon />,
                    <AdvancedRoomSettingsTab
                        room={this.state.room}
                        closeSettingsFn={() => this.props.onFinished(true)}
                    />,
                    "RoomSettingsAdvanced",
                ),
            );
        }

        return tabs as NonEmptyArray<Tab<RoomSettingsTab>>;
    }

    public render(): React.ReactNode {
        const roomName = this.state.room.name;
        return (
            <SDKContext.Provider value={this.props.sdkContext}>
                <BaseDialog
                    className="mx_RoomSettingsDialog"
                    hasCancel={true}
                    onFinished={this.props.onFinished}
                    title={_t("room_settings|title", { roomName })}
                >
                    <div className="mx_SettingsDialog_content">
                        <TabbedView
                            tabs={this.getTabs()}
                            activeTabId={this.state.activeTabId}
                            screenName="RoomSettings"
                            onChange={this.onTabChange}
                        />
                    </div>
                </BaseDialog>
            </SDKContext.Provider>
        );
    }
}

const WrappedRoomSettingsDialog: React.FC<IProps> = (props) => (
    <ErrorBoundary>
        <RoomSettingsDialog {...props} />
    </ErrorBoundary>
);

export default WrappedRoomSettingsDialog;
