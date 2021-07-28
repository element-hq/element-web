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
import { GuestAccess, HistoryVisibility, JoinRule, RestrictedAllowType } from "matrix-js-sdk/src/@types/partials";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from 'matrix-js-sdk/src/@types/event';

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup, { IDefinition } from '../../../elements/StyledRadioGroup';
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import AccessibleButton from "../../../elements/AccessibleButton";
import SpaceStore from "../../../../../stores/SpaceStore";
import RoomAvatar from "../../../avatars/RoomAvatar";
import ManageRestrictedJoinRuleDialog from '../../../dialogs/ManageRestrictedJoinRuleDialog';
import RoomUpgradeWarningDialog from '../../../dialogs/RoomUpgradeWarningDialog';
import { upgradeRoom } from "../../../../../utils/RoomUpgrade";
import { arrayHasDiff } from "../../../../../utils/arrays";
import SettingsFlag from '../../../elements/SettingsFlag';

interface IProps {
    roomId: string;
}

interface IState {
    joinRule: JoinRule;
    restrictedAllowRoomIds?: string[];
    guestAccess: GuestAccess;
    history: HistoryVisibility;
    hasAliases: boolean;
    encrypted: boolean;
    roomSupportsRestricted?: boolean;
    preferredRestrictionVersion?: string;
    showAdvancedSection: boolean;
}

@replaceableComponent("views.settings.tabs.room.SecurityRoomSettingsTab")
export default class SecurityRoomSettingsTab extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            joinRule: JoinRule.Invite,
            guestAccess: GuestAccess.Forbidden,
            history: HistoryVisibility.Shared,
            hasAliases: false,
            encrypted: false,
            showAdvancedSection: false,
        };
    }

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount() { // eslint-disable-line
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.events", this.onStateEvent);

        const room = cli.getRoom(this.props.roomId);
        const state = room.currentState;

        const joinRuleEvent = state.getStateEvents(EventType.RoomJoinRules, "");
        const joinRule: JoinRule = this.pullContentPropertyFromEvent<JoinRule>(
            joinRuleEvent,
            'join_rule',
            JoinRule.Invite,
        );
        const restrictedAllowRoomIds = joinRule === JoinRule.Restricted
            ? joinRuleEvent?.getContent().allow
                ?.filter(a => a.type === RestrictedAllowType.RoomMembership)
                ?.map(a => a.room_id)
            : undefined;

        const guestAccess: GuestAccess = this.pullContentPropertyFromEvent<GuestAccess>(
            state.getStateEvents(EventType.RoomGuestAccess, ""),
            'guest_access',
            GuestAccess.Forbidden,
        );
        const history: HistoryVisibility = this.pullContentPropertyFromEvent<HistoryVisibility>(
            state.getStateEvents(EventType.RoomHistoryVisibility, ""),
            'history_visibility',
            HistoryVisibility.Shared,
        );

        const encrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.roomId);
        const restrictedRoomCapabilities = SpaceStore.instance.restrictedJoinRuleSupport;
        const roomSupportsRestricted = Array.isArray(restrictedRoomCapabilities?.support)
            && restrictedRoomCapabilities.support.includes(room.getVersion());
        const preferredRestrictionVersion = roomSupportsRestricted ? undefined : restrictedRoomCapabilities?.preferred;
        this.setState({ joinRule, restrictedAllowRoomIds, guestAccess, history, encrypted,
            roomSupportsRestricted, preferredRestrictionVersion });

        this.hasAliases().then(hasAliases => this.setState({ hasAliases }));
    }

    private pullContentPropertyFromEvent<T>(event: MatrixEvent, key: string, defaultValue: T): T {
        return event?.getContent()[key] || defaultValue;
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
                    a: sub => <a
                        href="https://element.io/help#encryption"
                        rel="noreferrer noopener"
                        target="_blank"
                    >{ sub }</a>,
                },
            ),
            onFinished: (confirm) => {
                if (!confirm) {
                    this.setState({ encrypted: false });
                    return;
                }

                const beforeEncrypted = this.state.encrypted;
                this.setState({ encrypted: true });
                MatrixClientPeg.get().sendStateEvent(
                    this.props.roomId, EventType.RoomEncryption,
                    { algorithm: "m.megolm.v1.aes-sha2" },
                ).catch((e) => {
                    console.error(e);
                    this.setState({ encrypted: beforeEncrypted });
                });
            },
        });
    };

    private onJoinRuleChange = async (joinRule: JoinRule) => {
        const beforeJoinRule = this.state.joinRule;

        let restrictedAllowRoomIds: string[];
        if (joinRule === JoinRule.Restricted) {
            const matrixClient = MatrixClientPeg.get();
            const roomId = this.props.roomId;
            const room = matrixClient.getRoom(roomId);

            if (beforeJoinRule === JoinRule.Restricted || this.state.roomSupportsRestricted) {
                // Have the user pick which spaces to allow joins from
                restrictedAllowRoomIds = await this.editRestrictedRoomIds();
                if (!Array.isArray(restrictedAllowRoomIds)) return;
            } else if (this.state.preferredRestrictionVersion) {
                // Block this action on a room upgrade otherwise it'd make their room unjoinable
                const targetVersion = this.state.preferredRestrictionVersion;
                Modal.createTrackedDialog('Restricted join rule upgrade', '', RoomUpgradeWarningDialog, {
                    roomId,
                    targetVersion,
                    description: _t("This upgrade will allow members of selected spaces " +
                        "access to this room without an invite."),
                    onFinished: (resp) => {
                        if (!resp?.continue) return;
                        upgradeRoom(room, targetVersion, resp.invite);
                    },
                });
                return;
            }
        }

        if (beforeJoinRule === joinRule && !restrictedAllowRoomIds) return;

        const content: IContent = {
            join_rule: joinRule,
        };

        // pre-set the accepted spaces with the currently viewed one as per the microcopy
        if (joinRule === JoinRule.Restricted) {
            content.allow = restrictedAllowRoomIds.map(roomId => ({
                "type": RestrictedAllowType.RoomMembership,
                "room_id": roomId,
            }));
        }

        this.setState({ joinRule, restrictedAllowRoomIds });

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, EventType.RoomJoinRules, content, "").catch((e) => {
            console.error(e);
            this.setState({
                joinRule: beforeJoinRule,
                restrictedAllowRoomIds: undefined,
            });
        });
    };

    private onRestrictedRoomIdsChange = (restrictedAllowRoomIds: string[]) => {
        const beforeRestrictedAllowRoomIds = this.state.restrictedAllowRoomIds;
        if (!arrayHasDiff(beforeRestrictedAllowRoomIds || [], restrictedAllowRoomIds)) return;
        this.setState({ restrictedAllowRoomIds });

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, EventType.RoomJoinRules, {
            join_rule: JoinRule.Restricted,
            allow: restrictedAllowRoomIds.map(roomId => ({
                "type": RestrictedAllowType.RoomMembership,
                "room_id": roomId,
            })),
        }, "").catch((e) => {
            console.error(e);
            this.setState({ restrictedAllowRoomIds: beforeRestrictedAllowRoomIds });
        });
    };

    private onGuestAccessChange = (allowed: boolean) => {
        const guestAccess = allowed ? GuestAccess.CanJoin : GuestAccess.Forbidden;
        const beforeGuestAccess = this.state.guestAccess;
        if (beforeGuestAccess === guestAccess) return;

        this.setState({ guestAccess });

        const client = MatrixClientPeg.get();
        client.sendStateEvent(this.props.roomId, EventType.RoomGuestAccess, {
            guest_access: guestAccess,
        }, "").catch((e) => {
            console.error(e);
            this.setState({ guestAccess: beforeGuestAccess });
        });
    };

    private onHistoryRadioToggle = (history: HistoryVisibility) => {
        const beforeHistory = this.state.history;
        if (beforeHistory === history) return;

        this.setState({ history: history });
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, EventType.RoomHistoryVisibility, {
            history_visibility: history,
        }, "").catch((e) => {
            console.error(e);
            this.setState({ history: beforeHistory });
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

    private editRestrictedRoomIds = async (): Promise<string[] | undefined> => {
        let selected = this.state.restrictedAllowRoomIds;
        if (!selected?.length && SpaceStore.instance.activeSpace) {
            selected = [SpaceStore.instance.activeSpace.roomId];
        }

        const matrixClient = MatrixClientPeg.get();
        const { finished } = Modal.createTrackedDialog('Edit restricted', '', ManageRestrictedJoinRuleDialog, {
            matrixClient,
            room: matrixClient.getRoom(this.props.roomId),
            selected,
        }, "mx_ManageRestrictedJoinRuleDialog_wrapper");

        const [restrictedAllowRoomIds] = await finished;
        return restrictedAllowRoomIds;
    };

    private onEditRestrictedClick = async () => {
        const restrictedAllowRoomIds = await this.editRestrictedRoomIds();
        if (!Array.isArray(restrictedAllowRoomIds)) return;
        if (restrictedAllowRoomIds.length > 0) {
            this.onRestrictedRoomIdsChange(restrictedAllowRoomIds);
        } else {
            this.onJoinRuleChange(JoinRule.Invite);
        }
    };

    private renderJoinRule() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const joinRule = this.state.joinRule;

        const canChangeJoinRule = room.currentState.mayClientSendStateEvent(EventType.RoomJoinRules, client);

        let aliasWarning = null;
        if (joinRule === JoinRule.Public && !this.state.hasAliases) {
            aliasWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        { _t("To link to this room, please add an address.") }
                    </span>
                </div>
            );
        }

        const radioDefinitions: IDefinition<JoinRule>[] = [{
            value: JoinRule.Invite,
            label: _t("Private (invite only)"),
            description: _t("Only invited people can join."),
            checked: this.state.joinRule === JoinRule.Invite
                || (this.state.joinRule === JoinRule.Restricted && !this.state.restrictedAllowRoomIds?.length),
        }, {
            value: JoinRule.Public,
            label: _t("Public"),
            description: _t("Anyone can find and join."),
        }];

        if (this.state.roomSupportsRestricted ||
            this.state.preferredRestrictionVersion ||
            joinRule === JoinRule.Restricted
        ) {
            let upgradeRequiredPill;
            if (this.state.preferredRestrictionVersion) {
                upgradeRequiredPill = <span className="mx_SecurityRoomSettingsTab_upgradeRequired">
                    { _t("Upgrade required") }
                </span>;
            }

            let description;
            if (joinRule === JoinRule.Restricted && this.state.restrictedAllowRoomIds?.length) {
                const shownSpaces = this.state.restrictedAllowRoomIds
                    .map(roomId => client.getRoom(roomId))
                    .filter(room => room?.isSpaceRoom())
                    .slice(0, 4);

                let moreText;
                if (shownSpaces.length < this.state.restrictedAllowRoomIds.length) {
                    if (shownSpaces.length > 0) {
                        moreText = _t("& %(count)s more", {
                            count: this.state.restrictedAllowRoomIds.length - shownSpaces.length,
                        });
                    } else {
                        moreText = _t("Currently, %(count)s spaces have access", {
                            count: this.state.restrictedAllowRoomIds.length,
                        });
                    }
                }

                description = <div>
                    <span>
                        { _t("Anyone in a space can find and join. <a>Edit which spaces can access here.</a>", {}, {
                            a: sub => <AccessibleButton
                                disabled={!canChangeJoinRule}
                                onClick={this.onEditRestrictedClick}
                                kind="link"
                            >
                                { sub }
                            </AccessibleButton>,
                        }) }
                    </span>

                    <div className="mx_SecurityRoomSettingsTab_spacesWithAccess">
                        <h4>{ _t("Spaces with access") }</h4>
                        { shownSpaces.map(room => {
                            return <span key={room.roomId}>
                                <RoomAvatar room={room} height={32} width={32} />
                                { room.name }
                            </span>;
                        }) }
                        { moreText && <span>{ moreText }</span> }
                    </div>
                </div>;
            } else if (SpaceStore.instance.activeSpace) {
                description = _t("Anyone in %(spaceName)s can find and join. You can select other spaces too.", {
                    spaceName: SpaceStore.instance.activeSpace.name,
                });
            } else {
                description = _t("Anyone in a space can find and join. You can select multiple spaces.");
            }

            radioDefinitions.splice(1, 0, {
                value: JoinRule.Restricted,
                label: <>
                    { _t("Space members") }
                    { upgradeRequiredPill }
                </>,
                description,
                // if there are 0 allowed spaces then render it as invite only instead
                checked: this.state.joinRule === JoinRule.Restricted && !!this.state.restrictedAllowRoomIds?.length,
            });
        }

        return (
            <div className="mx_SecurityRoomSettingsTab_joinRule">
                <div className="mx_SettingsTab_subsectionText">
                    <span>{ _t("Decide who can join %(roomName)s.", {
                        roomName: client.getRoom(this.props.roomId)?.name,
                    }) }</span>
                </div>
                { aliasWarning }
                <StyledRadioGroup
                    name="joinRule"
                    value={joinRule}
                    onChange={this.onJoinRuleChange}
                    definitions={radioDefinitions}
                    disabled={!canChangeJoinRule}
                />
            </div>
        );
    }

    private renderHistory() {
        const client = MatrixClientPeg.get();
        const history = this.state.history;
        const state = client.getRoom(this.props.roomId).currentState;
        const canChangeHistory = state.mayClientSendStateEvent(EventType.RoomHistoryVisibility, client);

        const options = [
            {
                value: HistoryVisibility.Shared,
                label: _t('Members only (since the point in time of selecting this option)'),
            },
            {
                value: HistoryVisibility.Invited,
                label: _t('Members only (since they were invited)'),
            },
            {
                value: HistoryVisibility.Joined,
                label: _t('Members only (since they joined)'),
            },
        ];

        // World readable doesn't make sense for encrypted rooms
        if (!this.state.encrypted || history === HistoryVisibility.WorldReadable) {
            options.unshift({
                value: HistoryVisibility.WorldReadable,
                label: _t("Anyone"),
            });
        }

        return (
            <div>
                <div>
                    { _t('Changes to who can read history will only apply to future messages in this room. ' +
                        'The visibility of existing history will be unchanged.') }
                </div>
                <StyledRadioGroup
                    name="historyVis"
                    value={history}
                    onChange={this.onHistoryRadioToggle}
                    disabled={!canChangeHistory}
                    definitions={options}
                />
            </div>
        );
    }

    private toggleAdvancedSection = () => {
        this.setState({ showAdvancedSection: !this.state.showAdvancedSection });
    };

    private renderAdvanced() {
        const client = MatrixClientPeg.get();
        const guestAccess = this.state.guestAccess;
        const state = client.getRoom(this.props.roomId).currentState;
        const canSetGuestAccess = state.mayClientSendStateEvent(EventType.RoomGuestAccess, client);

        return <div className="mx_SettingsTab_section">
            <LabelledToggleSwitch
                value={guestAccess === GuestAccess.CanJoin}
                onChange={this.onGuestAccessChange}
                disabled={!canSetGuestAccess}
                label={_t("Enable guest access")}
            />
            <p>
                { _t("People with supported clients will be able to join " +
                    "the room without having a registered account.") }
            </p>
        </div>;
    }

    render() {
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
            <span className='mx_SettingsTab_subheading'>{ _t("Who can read history?") }</span>
            <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                { this.renderHistory() }
            </div>
        </>);
        if (!SettingsStore.getValue(UIFeature.RoomHistorySettings)) {
            historySection = null;
        }

        return (
            <div className="mx_SettingsTab mx_SecurityRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Security & Privacy") }</div>

                <span className='mx_SettingsTab_subheading'>{ _t("Encryption") }</span>
                <div className='mx_SettingsTab_section mx_SecurityRoomSettingsTab_encryptionSection'>
                    <div>
                        <div className='mx_SettingsTab_subsectionText'>
                            <span>{ _t("Once enabled, encryption cannot be disabled.") }</span>
                        </div>
                        <LabelledToggleSwitch
                            value={isEncrypted}
                            onChange={this.onEncryptionChange}
                            label={_t("Encrypted")}
                            disabled={!canEnableEncryption}
                        />
                    </div>
                    { encryptionSettings }
                </div>

                <span className='mx_SettingsTab_subheading'>{ _t("Access") }</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    { this.renderJoinRule() }
                </div>

                <AccessibleButton
                    onClick={this.toggleAdvancedSection}
                    kind="link"
                    className="mx_SettingsTab_showAdvanced"
                >
                    { this.state.showAdvancedSection ? _t("Hide advanced") : _t("Show advanced") }
                </AccessibleButton>
                { this.state.showAdvancedSection && this.renderAdvanced() }

                { historySection }
            </div>
        );
    }
}
