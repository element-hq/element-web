/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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
import { GuestAccess, HistoryVisibility, JoinRule } from "matrix-js-sdk/src/@types/partials";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { IRoomVersionsCapability } from 'matrix-js-sdk/src/client';
import { EventType } from 'matrix-js-sdk/src/@types/event';

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../..";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup, { IDefinition } from '../../../elements/StyledRadioGroup';
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";

interface IProps {
    roomId: string;
}

interface IState {
    joinRule: JoinRule;
    guestAccess: GuestAccess;
    history: HistoryVisibility;
    hasAliases: boolean;
    encrypted: boolean;
    roomVersionsCapability?: IRoomVersionsCapability;
}

enum RoomVisibility {
    InviteOnly = "invite_only",
    PublicNoGuests = "public_no_guests",
    PublicWithGuests = "public_with_guests",
    Restricted = "restricted",
}

@replaceableComponent("views.settings.tabs.room.SecurityRoomSettingsTab")
export default class SecurityRoomSettingsTab extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            joinRule: JoinRule.Invite,
            guestAccess: GuestAccess.CanJoin,
            history: HistoryVisibility.Shared,
            hasAliases: false,
            encrypted: false,
        };
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.events", this.onStateEvent);

        const room = cli.getRoom(this.props.roomId);
        const state = room.currentState;

        const joinRule: JoinRule = this.pullContentPropertyFromEvent(
            state.getStateEvents(EventType.RoomJoinRules, ""),
            'join_rule',
            JoinRule.Invite,
        );
        const guestAccess: GuestAccess = this.pullContentPropertyFromEvent(
            state.getStateEvents(EventType.RoomGuestAccess, ""),
            'guest_access',
            GuestAccess.Forbidden,
        );
        const history: HistoryVisibility = this.pullContentPropertyFromEvent(
            state.getStateEvents(EventType.RoomHistoryVisibility, ""),
            'history_visibility',
            HistoryVisibility.Shared,
        );

        const encrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.roomId);
        this.setState({ joinRule, guestAccess, history, encrypted });

        this.hasAliases().then(hasAliases => this.setState({ hasAliases }));
        cli.getCapabilities().then(capabilities => this.setState({
            roomVersionsCapability: capabilities["m.room_versions"],
        }));
    }

    private pullContentPropertyFromEvent<T>(event: MatrixEvent, key: string, defaultValue: T): T {
        if (!event || !event.getContent()) return defaultValue;
        return event.getContent()[key] || defaultValue;
    }

    componentWillUnmount() {
        MatrixClientPeg.get().removeListener("RoomState.events", this.onStateEvent);
    }

    private onStateEvent = (e: MatrixEvent) => {
        const refreshWhenTypes: EventType[] = [
            EventType.RoomJoinRules,
            EventType.RoomGuestAccess,
            EventType.RoomHistoryVisibility,
            EventType.RoomEncryption,
        ];
        if (refreshWhenTypes.includes(e.getType() as EventType)) this.forceUpdate();
    };

    private onEncryptionChange = () => {
        Modal.createTrackedDialog('Enable encryption', '', QuestionDialog, {
            title: _t('Enable encryption?'),
            description: _t(
                "Once enabled, encryption for a room cannot be disabled. Messages sent in an encrypted " +
                "room cannot be seen by the server, only by the participants of the room. Enabling encryption " +
                "may prevent many bots and bridges from working correctly. <a>Learn more about encryption.</a>",
                {},
                {
                    a: sub => <a href="https://element.io/help#encryption"
                        rel="noreferrer noopener" target="_blank"
                    >{sub}</a>,
                },
            ),
            onFinished: (confirm) => {
                if (!confirm) {
                    this.setState({encrypted: false});
                    return;
                }

                const beforeEncrypted = this.state.encrypted;
                this.setState({encrypted: true});
                MatrixClientPeg.get().sendStateEvent(
                    this.props.roomId, EventType.RoomEncryption,
                    { algorithm: "m.megolm.v1.aes-sha2" },
                ).catch((e) => {
                    console.error(e);
                    this.setState({encrypted: beforeEncrypted});
                });
            },
        });
    };

    private fixGuestAccess = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const guestAccess = GuestAccess.CanJoin;

        const beforeGuestAccess = this.state.guestAccess;
        this.setState({ guestAccess });

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, EventType.RoomGuestAccess, {
            guest_access: guestAccess,
        }, "").catch((e) => {
            console.error(e);
            this.setState({guestAccess: beforeGuestAccess});
        });
    };

    private onRoomAccessRadioToggle = (roomAccess: RoomVisibility) => {
        //                         join_rule
        //                      INVITE  |  PUBLIC        | RESTRICTED
        //        -----------+----------+----------------+-------------
        // guest  CAN_JOIN   | inv_only | pub_with_guest | restricted
        // access -----------+----------+----------------+-------------
        //        FORBIDDEN  | inv_only | pub_no_guest   | restricted
        //        -----------+----------+----------------+-------------

        // we always set guests can_join here as it makes no sense to have
        // an invite-only room that guests can't join.  If you explicitly
        // invite them, you clearly want them to join, whether they're a
        // guest or not.  In practice, guest_access should probably have
        // been implemented as part of the join_rules enum.
        let joinRule = JoinRule.Invite;
        let guestAccess = GuestAccess.CanJoin;

        switch (roomAccess) {
            case RoomVisibility.InviteOnly:
                // no change - use defaults above
                break;
            case RoomVisibility.Restricted:
                joinRule = JoinRule.Restricted;
                break;
            case RoomVisibility.PublicNoGuests:
                joinRule = JoinRule.Public;
                guestAccess = GuestAccess.Forbidden;
                break;
            case RoomVisibility.PublicWithGuests:
                joinRule = JoinRule.Public;
                guestAccess = GuestAccess.CanJoin;
                break;
        }

        const beforeJoinRule = this.state.joinRule;
        const beforeGuestAccess = this.state.guestAccess;
        this.setState({joinRule, guestAccess});

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, EventType.RoomJoinRules, {
            join_rule: joinRule,
        }, "").catch((e) => {
            console.error(e);
            this.setState({joinRule: beforeJoinRule});
        });
        client.sendStateEvent(this.props.roomId, EventType.RoomGuestAccess, {
            guest_access: guestAccess,
        }, "").catch((e) => {
            console.error(e);
            this.setState({guestAccess: beforeGuestAccess});
        });
    };

    private onHistoryRadioToggle = (history: HistoryVisibility) => {
        const beforeHistory = this.state.history;
        this.setState({history: history});
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, EventType.RoomHistoryVisibility, {
            history_visibility: history,
        }, "").catch((e) => {
            console.error(e);
            this.setState({history: beforeHistory});
        });
    };

    private updateBlacklistDevicesFlag = (checked: boolean) => {
        MatrixClientPeg.get().getRoom(this.props.roomId).setBlacklistUnverifiedDevices(checked);
    };

    private async hasAliases(): Promise<boolean> {
        const cli = MatrixClientPeg.get();
        if (await cli.doesServerSupportUnstableFeature("org.matrix.msc2432")) {
            const response = await cli.unstableGetLocalAliases(this.props.roomId);
            const localAliases = response.aliases;
            return Array.isArray(localAliases) && localAliases.length !== 0;
        } else {
            const room = cli.getRoom(this.props.roomId);
            const aliasEvents = room.currentState.getStateEvents(EventType.RoomAliases) || [];
            const hasAliases = !!aliasEvents.find((ev) => (ev.getContent().aliases || []).length > 0);
            return hasAliases;
        }
    }

    private renderRoomAccess() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const joinRule = this.state.joinRule;
        const guestAccess = this.state.guestAccess;

        const canChangeAccess = room.currentState.mayClientSendStateEvent(EventType.RoomJoinRules, client)
            && room.currentState.mayClientSendStateEvent(EventType.RoomGuestAccess, client);

        let guestWarning = null;
        if (joinRule !== JoinRule.Public && guestAccess === GuestAccess.Forbidden) {
            guestWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("Guests cannot join this room even if explicitly invited.")}&nbsp;
                        <a href="" onClick={this.fixGuestAccess}>{_t("Click here to fix")}</a>
                    </span>
                </div>
            );
        }

        let aliasWarning = null;
        if (joinRule === JoinRule.Public && !this.state.hasAliases) {
            aliasWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        {_t("To link to this room, please add an address.")}
                    </span>
                </div>
            );
        }

        const radioDefinitions: IDefinition<RoomVisibility>[] = [
            {
                value: RoomVisibility.InviteOnly,
                label: _t('Only people who have been invited'),
                checked: joinRule !== JoinRule.Public && joinRule !== JoinRule.Restricted,
            },
            {
                value: RoomVisibility.PublicNoGuests,
                label: _t('Anyone who knows the room\'s link, apart from guests'),
                checked: joinRule === JoinRule.Public && guestAccess !== GuestAccess.CanJoin,
            },
            {
                value: RoomVisibility.PublicWithGuests,
                label: _t("Anyone who knows the room's link, including guests"),
                checked: joinRule === JoinRule.Public && guestAccess === GuestAccess.CanJoin,
            },
        ];

        const roomCapabilities = this.state.roomVersionsCapability?.["org.matrix.msc3244.room_capabilities"];
        if (roomCapabilities?.["restricted"]) {
            if (Array.isArray(roomCapabilities["restricted"]?.support) &&
                roomCapabilities["restricted"].support.includes(room.getVersion() ?? "1")
            ) {
                radioDefinitions.unshift({
                    value: RoomVisibility.Restricted,
                    label: _t("Only people in certain spaces or those who have been invited (TODO copy)"),
                    checked: joinRule === JoinRule.Restricted,
                });
            }
        }

        return (
            <div>
                { guestWarning }
                { aliasWarning }
                <StyledRadioGroup
                    name="roomVis"
                    onChange={this.onRoomAccessRadioToggle}
                    definitions={radioDefinitions}
                    disabled={!canChangeAccess}
                />
            </div>
        );
    }

    private renderHistory() {
        const client = MatrixClientPeg.get();
        const history = this.state.history;
        const state = client.getRoom(this.props.roomId).currentState;
        const canChangeHistory = state.mayClientSendStateEvent(EventType.RoomHistoryVisibility, client);

        return (
            <div>
                <div>
                    {_t('Changes to who can read history will only apply to future messages in this room. ' +
                        'The visibility of existing history will be unchanged.')}
                </div>
                <StyledRadioGroup
                    name="historyVis"
                    value={history}
                    onChange={this.onHistoryRadioToggle}
                    definitions={[
                        {
                            value: HistoryVisibility.WorldReadable,
                            disabled: !canChangeHistory,
                            label: _t("Anyone"),
                        },
                        {
                            value: HistoryVisibility.Shared,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since the point in time of selecting this option)'),
                        },
                        {
                            value: HistoryVisibility.Invited,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since they were invited)'),
                        },
                        {
                            value: HistoryVisibility.Joined,
                            disabled: !canChangeHistory,
                            label: _t('Members only (since they joined)'),
                        },
                    ]}
                />
            </div>
        );
    }

    render() {
        const SettingsFlag = sdk.getComponent("elements.SettingsFlag");

        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const isEncrypted = this.state.encrypted;
        const hasEncryptionPermission = room.currentState.mayClientSendStateEvent(EventType.RoomEncryption, client);
        const canEnableEncryption = !isEncrypted && hasEncryptionPermission;

        let encryptionSettings = null;
        if (isEncrypted && SettingsStore.isEnabled("blacklistUnverifiedDevices")) {
            encryptionSettings = <SettingsFlag
                name="blacklistUnverifiedDevices"
                level={SettingLevel.ROOM_DEVICE}
                onChange={this.updateBlacklistDevicesFlag}
                roomId={this.props.roomId}
            />;
        }

        let historySection = (<>
            <span className='mx_SettingsTab_subheading'>{_t("Who can read history?")}</span>
            <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                {this.renderHistory()}
            </div>
        </>);
        if (!SettingsStore.getValue(UIFeature.RoomHistorySettings)) {
            historySection = null;
        }

        return (
            <div className="mx_SettingsTab mx_SecurityRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Security & Privacy")}</div>

                <span className='mx_SettingsTab_subheading'>{_t("Encryption")}</span>
                <div className='mx_SettingsTab_section mx_SecurityRoomSettingsTab_encryptionSection'>
                    <div>
                        <div className='mx_SettingsTab_subsectionText'>
                            <span>{_t("Once enabled, encryption cannot be disabled.")}</span>
                        </div>
                        <LabelledToggleSwitch value={isEncrypted} onChange={this.onEncryptionChange}
                            label={_t("Encrypted")} disabled={!canEnableEncryption}
                        />
                    </div>
                    {encryptionSettings}
                </div>

                <span className='mx_SettingsTab_subheading'>{_t("Who can access this room?")}</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    {this.renderRoomAccess()}
                </div>

                {historySection}
            </div>
        );
    }
}
