/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import {
    EventType,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
    type Room,
    type IContent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { throttle, get } from "lodash";
import { KnownMembership, type RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";

import { _t, _td, type TranslationKey } from "../../../../../languageHandler";
import AccessibleButton from "../../../elements/AccessibleButton";
import Modal from "../../../../../Modal";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import PowerSelector from "../../../elements/PowerSelector";
import SettingsFieldset from "../../SettingsFieldset";
import SettingsStore from "../../../../../settings/SettingsStore";
import { ElementCall } from "../../../../../models/Call";
import SdkConfig, { DEFAULTS } from "../../../../../SdkConfig";
import { AddPrivilegedUsers } from "../../AddPrivilegedUsers";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { PowerLevelSelector } from "../../PowerLevelSelector";

interface IEventShowOpts {
    isState?: boolean;
    hideForSpace?: boolean;
    hideForRoom?: boolean;
}

interface IPowerLevelDescriptor {
    desc: string;
    defaultValue: number;
    hideForSpace?: boolean;
}

const plEventsToShow: Record<string, IEventShowOpts> = {
    // If an event is listed here, it will be shown in the PL settings. Defaults will be calculated.
    [EventType.RoomAvatar]: { isState: true },
    [EventType.RoomName]: { isState: true },
    [EventType.RoomCanonicalAlias]: { isState: true },
    [EventType.SpaceChild]: { isState: true, hideForRoom: true },
    [EventType.RoomHistoryVisibility]: { isState: true, hideForSpace: true },
    [EventType.RoomPowerLevels]: { isState: true },
    [EventType.RoomTopic]: { isState: true },
    [EventType.RoomTombstone]: { isState: true, hideForSpace: true },
    [EventType.RoomEncryption]: { isState: true, hideForSpace: true },
    [EventType.RoomServerAcl]: { isState: true, hideForSpace: true },
    [EventType.RoomPinnedEvents]: { isState: true, hideForSpace: true },
    [EventType.Reaction]: { isState: false, hideForSpace: true },
    [EventType.RoomRedaction]: { isState: false, hideForSpace: true },

    // MSC3401: Native Group VoIP signaling
    [ElementCall.CALL_EVENT_TYPE.name]: { isState: true, hideForSpace: true },
    [ElementCall.MEMBER_EVENT_TYPE.name]: { isState: true, hideForSpace: true },

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    "im.vector.modular.widgets": { isState: true, hideForSpace: true },
};

// parse a string as an integer; if the input is undefined, or cannot be parsed
// as an integer, return a default.
function parseIntWithDefault(val: string, def: number): number {
    const res = parseInt(val);
    return isNaN(res) ? def : res;
}

interface IBannedUserProps {
    canUnban?: boolean;
    member: RoomMember;
    by: string;
    reason?: string;
}

export class BannedUser extends React.Component<IBannedUserProps> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    private onUnbanClick = (): void => {
        this.context.unban(this.props.member.roomId, this.props.member.userId).catch((err) => {
            logger.error("Failed to unban: " + err);
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("room_settings|permissions|error_unbanning"),
            });
        });
    };

    public render(): React.ReactNode {
        let unbanButton;

        if (this.props.canUnban) {
            unbanButton = (
                <AccessibleButton
                    className="mx_RolesRoomSettingsTab_unbanBtn"
                    kind="danger_sm"
                    onClick={this.onUnbanClick}
                >
                    {_t("action|unban")}
                </AccessibleButton>
            );
        }

        const userId = this.props.member.name === this.props.member.userId ? null : this.props.member.userId;
        return (
            <li>
                {unbanButton}
                <span title={_t("room_settings|permissions|banned_by", { displayName: this.props.by })}>
                    <strong>{this.props.member.name}</strong> {userId}
                    {this.props.reason
                        ? " " + _t("room_settings|permissions|ban_reason") + ": " + this.props.reason
                        : ""}
                </span>
            </li>
        );
    }
}

interface IProps {
    room: Room;
}

interface RolesRoomSettingsTabState {
    isRoomEncrypted: boolean;
    isReady: boolean;
}

export default class RolesRoomSettingsTab extends React.Component<IProps, RolesRoomSettingsTabState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps) {
        super(props);
        this.state = {
            isReady: false,
            isRoomEncrypted: false,
        };
    }

    public async componentDidMount(): Promise<void> {
        this.context.on(RoomStateEvent.Update, this.onRoomStateUpdate);
        this.setState({
            isRoomEncrypted:
                (await this.context.getCrypto()?.isEncryptionEnabledInRoom(this.props.room.roomId)) || false,
            isReady: true,
        });
    }

    public componentWillUnmount(): void {
        const client = this.context;
        if (client) {
            client.removeListener(RoomStateEvent.Update, this.onRoomStateUpdate);
        }
    }

    private onRoomStateUpdate = (state: RoomState): void => {
        if (state.roomId !== this.props.room.roomId) return;
        this.onThisRoomMembership();
    };

    private onThisRoomMembership = throttle(
        () => {
            this.forceUpdate();
        },
        200,
        { leading: true, trailing: true },
    );

    private populateDefaultPlEvents(
        eventsSection: Record<string, number>,
        stateLevel: number,
        eventsLevel: number,
    ): void {
        for (const desiredEvent of Object.keys(plEventsToShow)) {
            if (!(desiredEvent in eventsSection)) {
                eventsSection[desiredEvent] = plEventsToShow[desiredEvent].isState ? stateLevel : eventsLevel;
            }
        }
    }

    private onPowerLevelsChanged = async (value: number, powerLevelKey: string): Promise<void> => {
        const client = this.context;
        const room = this.props.room;
        const plEvent = room.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        let plContent = plEvent?.getContent<RoomPowerLevelsEventContent>() ?? {};

        // Clone the power levels just in case
        plContent = Object.assign({}, plContent);

        const eventsLevelPrefix = "event_levels_";

        if (powerLevelKey.startsWith(eventsLevelPrefix)) {
            // deep copy "events" object, Object.assign itself won't deep copy
            plContent["events"] = Object.assign({}, plContent["events"] || {});
            plContent["events"][powerLevelKey.slice(eventsLevelPrefix.length)] = value;
        } else {
            const keyPath = powerLevelKey.split(".");
            let parentObj: IContent = {};
            let currentObj: IContent = plContent;
            for (const key of keyPath) {
                if (!currentObj[key]) {
                    currentObj[key] = {};
                }
                parentObj = currentObj;
                currentObj = currentObj[key];
            }
            parentObj[keyPath[keyPath.length - 1]] = value;
        }

        try {
            await client.sendStateEvent(this.props.room.roomId, EventType.RoomPowerLevels, plContent);
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("room_settings|permissions|error_changing_pl_reqs_title"),
                description: _t("room_settings|permissions|error_changing_pl_reqs_description"),
            });

            // Rethrow so that the PowerSelector can roll back
            throw e;
        }
    };

    private onUserPowerLevelChanged = async (value: number, powerLevelKey: string): Promise<void> => {
        const client = this.context;
        const room = this.props.room;
        const plEvent = room.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        let plContent = plEvent?.getContent<RoomPowerLevelsEventContent>() ?? {};

        // Clone the power levels just in case
        plContent = Object.assign({}, plContent);

        // powerLevelKey should be a user ID
        if (!plContent["users"]) plContent["users"] = {};
        plContent["users"][powerLevelKey] = value;

        try {
            await client.sendStateEvent(this.props.room.roomId, EventType.RoomPowerLevels, plContent);
        } catch (e) {
            logger.error(e);

            Modal.createDialog(ErrorDialog, {
                title: _t("room_settings|permissions|error_changing_pl_title"),
                description: _t("room_settings|permissions|error_changing_pl_description"),
            });
        }
    };

    public render(): React.ReactNode {
        const client = this.context;
        const room = this.props.room;
        const isSpaceRoom = room.isSpaceRoom();

        const plEvent = room.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        const plContent = plEvent ? plEvent.getContent() || {} : {};
        const canChangeLevels = room.currentState.mayClientSendStateEvent(EventType.RoomPowerLevels, client);

        const plEventsToLabels: Record<EventType | string, TranslationKey | null> = {
            // These will be translated for us later.
            [EventType.RoomAvatar]: isSpaceRoom
                ? _td("room_settings|permissions|m.room.avatar_space")
                : _td("room_settings|permissions|m.room.avatar"),
            [EventType.RoomName]: isSpaceRoom
                ? _td("room_settings|permissions|m.room.name_space")
                : _td("room_settings|permissions|m.room.name"),
            [EventType.RoomCanonicalAlias]: isSpaceRoom
                ? _td("room_settings|permissions|m.room.canonical_alias_space")
                : _td("room_settings|permissions|m.room.canonical_alias"),
            [EventType.SpaceChild]: _td("room_settings|permissions|m.space.child"),
            [EventType.RoomHistoryVisibility]: _td("room_settings|permissions|m.room.history_visibility"),
            [EventType.RoomPowerLevels]: _td("room_settings|permissions|m.room.power_levels"),
            [EventType.RoomTopic]: isSpaceRoom
                ? _td("room_settings|permissions|m.room.topic_space")
                : _td("room_settings|permissions|m.room.topic"),
            [EventType.RoomTombstone]: _td("room_settings|permissions|m.room.tombstone"),
            [EventType.RoomEncryption]: _td("room_settings|permissions|m.room.encryption"),
            [EventType.RoomServerAcl]: _td("room_settings|permissions|m.room.server_acl"),
            [EventType.Reaction]: _td("room_settings|permissions|m.reaction"),
            [EventType.RoomRedaction]: _td("room_settings|permissions|m.room.redaction"),
            [EventType.RoomPinnedEvents]: _td("room_settings|permissions|m.room.pinned_events"),

            // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
            "im.vector.modular.widgets": isSpaceRoom ? null : _td("room_settings|permissions|m.widget"),
        };

        // MSC3401: Native Group VoIP signaling
        if (SettingsStore.getValue("feature_group_calls")) {
            plEventsToLabels[ElementCall.CALL_EVENT_TYPE.name] = _td("room_settings|permissions|m.call");
            plEventsToLabels[ElementCall.MEMBER_EVENT_TYPE.name] = _td("room_settings|permissions|m.call.member");
        }

        const powerLevelDescriptors: Record<string, IPowerLevelDescriptor> = {
            "users_default": {
                desc: _t("room_settings|permissions|users_default"),
                defaultValue: 0,
            },
            "events_default": {
                desc: _t("room_settings|permissions|events_default"),
                defaultValue: 0,
                hideForSpace: true,
            },
            "invite": {
                desc: _t("room_settings|permissions|invite"),
                defaultValue: 0,
            },
            "state_default": {
                desc: _t("room_settings|permissions|state_default"),
                defaultValue: 50,
            },
            "kick": {
                desc: _t("room_settings|permissions|kick"),
                defaultValue: 50,
            },
            "ban": {
                desc: _t("room_settings|permissions|ban"),
                defaultValue: 50,
            },
            "redact": {
                desc: _t("room_settings|permissions|redact"),
                defaultValue: 50,
                hideForSpace: true,
            },
            "notifications.room": {
                desc: _t("room_settings|permissions|notifications.room"),
                defaultValue: 50,
                hideForSpace: true,
            },
        };

        const eventsLevels = plContent.events || {};
        const userLevels = plContent.users || {};
        const banLevel = parseIntWithDefault(plContent.ban, powerLevelDescriptors.ban.defaultValue);
        const defaultUserLevel = parseIntWithDefault(
            plContent.users_default,
            powerLevelDescriptors.users_default.defaultValue,
        );

        let currentUserLevel = userLevels[client.getUserId()!];
        if (currentUserLevel === undefined) {
            currentUserLevel = defaultUserLevel;
        }

        this.populateDefaultPlEvents(
            eventsLevels,
            parseIntWithDefault(plContent.state_default, powerLevelDescriptors.state_default.defaultValue),
            parseIntWithDefault(plContent.events_default, powerLevelDescriptors.events_default.defaultValue),
        );

        let privilegedUsersSection = <div>{_t("room_settings|permissions|no_privileged_users")}</div>;
        let mutedUsersSection;
        if (Object.keys(userLevels).length) {
            privilegedUsersSection = (
                <PowerLevelSelector
                    title={_t("room_settings|permissions|privileged_users_section")}
                    userLevels={userLevels}
                    canChangeLevels={canChangeLevels}
                    currentUserLevel={currentUserLevel}
                    onClick={this.onUserPowerLevelChanged}
                    filter={(user) => userLevels[user] > defaultUserLevel}
                >
                    <div>{_t("room_settings|permissions|no_privileged_users")}</div>
                </PowerLevelSelector>
            );

            mutedUsersSection = (
                <PowerLevelSelector
                    title={_t("room_settings|permissions|muted_users_section")}
                    userLevels={userLevels}
                    canChangeLevels={canChangeLevels}
                    currentUserLevel={currentUserLevel}
                    onClick={this.onUserPowerLevelChanged}
                    filter={(user) => userLevels[user] < defaultUserLevel}
                />
            );
        }

        const banned = room.getMembersWithMembership(KnownMembership.Ban);
        let bannedUsersSection: JSX.Element | undefined;
        if (banned?.length) {
            const canBanUsers = currentUserLevel >= banLevel;
            bannedUsersSection = (
                <SettingsFieldset legend={_t("room_settings|permissions|banned_users_section")}>
                    <ul className="mx_RolesRoomSettingsTab_bannedList">
                        {banned.map((member) => {
                            const banEvent = member.events.member?.getContent();
                            const bannedById = member.events.member?.getSender();
                            const sender = bannedById ? room.getMember(bannedById) : undefined;
                            const bannedBy = sender?.name || bannedById; // fallback to mxid
                            return (
                                <BannedUser
                                    key={member.userId}
                                    canUnban={canBanUsers}
                                    member={member}
                                    reason={banEvent?.reason}
                                    by={bannedBy!}
                                />
                            );
                        })}
                    </ul>
                </SettingsFieldset>
            );
        }

        const powerSelectors = Object.keys(powerLevelDescriptors)
            .map((key, index) => {
                const descriptor = powerLevelDescriptors[key];
                if (isSpaceRoom && descriptor.hideForSpace) {
                    return null;
                }

                const value = parseIntWithDefault(get(plContent, key), descriptor.defaultValue);
                return (
                    <div key={index} className="">
                        <PowerSelector
                            label={descriptor.desc}
                            value={value}
                            usersDefault={defaultUserLevel}
                            disabled={!canChangeLevels || currentUserLevel < value}
                            powerLevelKey={key} // Will be sent as the second parameter to `onChange`
                            onChange={this.onPowerLevelsChanged}
                        />
                    </div>
                );
            })
            .filter(Boolean);

        // hide the power level selector for enabling E2EE if it the room is already encrypted
        if (this.state.isRoomEncrypted) {
            delete eventsLevels[EventType.RoomEncryption];
        }

        const eventPowerSelectors = Object.keys(eventsLevels)
            .map((eventType, i) => {
                if (isSpaceRoom && plEventsToShow[eventType]?.hideForSpace) {
                    return null;
                } else if (!isSpaceRoom && plEventsToShow[eventType]?.hideForRoom) {
                    return null;
                }

                const translationKeyForEvent = plEventsToLabels[eventType];
                let label: string;
                if (translationKeyForEvent) {
                    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;
                    label = _t(translationKeyForEvent, { brand });
                } else {
                    label = _t("room_settings|permissions|send_event_type", { eventType });
                }
                return (
                    <div key={eventType}>
                        <PowerSelector
                            label={label}
                            value={eventsLevels[eventType]}
                            usersDefault={defaultUserLevel}
                            disabled={!canChangeLevels || currentUserLevel < eventsLevels[eventType]}
                            powerLevelKey={"event_levels_" + eventType}
                            onChange={this.onPowerLevelsChanged}
                        />
                    </div>
                );
            })
            .filter(Boolean);

        return (
            <SettingsTab>
                <SettingsSection heading={_t("room_settings|permissions|title")}>
                    {privilegedUsersSection}
                    {canChangeLevels && <AddPrivilegedUsers room={room} defaultUserLevel={defaultUserLevel} />}
                    {mutedUsersSection}
                    {bannedUsersSection}
                    {this.state.isReady && (
                        <SettingsFieldset
                            legend={_t("room_settings|permissions|permissions_section")}
                            description={
                                isSpaceRoom
                                    ? _t("room_settings|permissions|permissions_section_description_space")
                                    : _t("room_settings|permissions|permissions_section_description_room")
                            }
                        >
                            {powerSelectors}
                            {eventPowerSelectors}
                        </SettingsFieldset>
                    )}
                </SettingsSection>
            </SettingsTab>
        );
    }
}
