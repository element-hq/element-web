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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from 'matrix-js-sdk/src/@types/event';
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup from '../../../elements/StyledRadioGroup';
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import AccessibleButton from "../../../elements/AccessibleButton";
import SettingsFlag from '../../../elements/SettingsFlag';
import createRoom, { IOpts } from '../../../../../createRoom';
import CreateRoomDialog from '../../../dialogs/CreateRoomDialog';
import JoinRuleSettings from "../../JoinRuleSettings";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import SettingsFieldset from '../../SettingsFieldset';

interface IProps {
    roomId: string;
    closeSettingsFn: () => void;
}

interface IState {
    restrictedAllowRoomIds?: string[];
    guestAccess: GuestAccess;
    history: HistoryVisibility;
    hasAliases: boolean;
    encrypted: boolean;
    showAdvancedSection: boolean;
}

@replaceableComponent("views.settings.tabs.room.SecurityRoomSettingsTab")
export default class SecurityRoomSettingsTab extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
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
        this.setState({ restrictedAllowRoomIds, guestAccess, history, encrypted });

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

    private onEncryptionChange = async () => {
        if (MatrixClientPeg.get().getRoom(this.props.roomId)?.getJoinRule() === JoinRule.Public) {
            const dialog = Modal.createTrackedDialog('Confirm Public Encrypted Room', '', QuestionDialog, {
                title: _t('Are you sure you want to add encryption to this public room?'),
                description: <div>
                    <p> { _t(
                        "<b>It's not recommended to add encryption to public rooms.</b>" +
                        "Anyone can find and join public rooms, so anyone can read messages in them. " +
                        "You'll get none of the benefits of encryption, and you won't be able to turn it " +
                        "off later. Encrypting messages in a public room will make receiving and sending " +
                        "messages slower.",
                        null,
                        { "b": (sub) => <b>{ sub }</b> },
                    ) } </p>
                    <p> { _t(
                        "To avoid these issues, create a <a>new encrypted room</a> for " +
                        "the conversation you plan to have.",
                        null,
                        { "a": (sub) => <a
                            className="mx_linkButton"
                            onClick={() => {
                                dialog.close();
                                this.createNewRoom(false, true);
                            }}> { sub } </a> },
                    ) } </p>
                </div>,

            });

            const { finished } = dialog;
            const [confirm] = await finished;
            if (!confirm) return;
        }

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
                    logger.error(e);
                    this.setState({ encrypted: beforeEncrypted });
                });
            },
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
            logger.error(e);
            this.setState({ guestAccess: beforeGuestAccess });
        });
    };

    private createNewRoom = async (defaultPublic: boolean, defaultEncrypted: boolean) => {
        const modal = Modal.createTrackedDialog<[boolean, IOpts]>(
            "Create Room",
            "Create room after trying to make an E2EE room public",
            CreateRoomDialog,
            { defaultPublic, defaultEncrypted },
        );
        const [shouldCreate, opts] = await modal.finished;
        if (shouldCreate) {
            await createRoom(opts);
        }
        return shouldCreate;
    };

    private onHistoryRadioToggle = (history: HistoryVisibility) => {
        const beforeHistory = this.state.history;
        if (beforeHistory === history) return;

        this.setState({ history: history });
        MatrixClientPeg.get().sendStateEvent(this.props.roomId, EventType.RoomHistoryVisibility, {
            history_visibility: history,
        }, "").catch((e) => {
            logger.error(e);
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

    private renderJoinRule() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        let aliasWarning = null;
        if (room.getJoinRule() === JoinRule.Public && !this.state.hasAliases) {
            aliasWarning = (
                <div className='mx_SecurityRoomSettingsTab_warning'>
                    <img src={require("../../../../../../res/img/warning.svg")} width={15} height={15} />
                    <span>
                        { _t("To link to this room, please add an address.") }
                    </span>
                </div>
            );
        }
        const description = _t("Decide who can join %(roomName)s.", {
            roomName: room?.name,
        });

        return <SettingsFieldset legend={_t("Access")} description={description}>
            { aliasWarning }

            <JoinRuleSettings
                room={room}
                beforeChange={this.onBeforeJoinRuleChange}
                onError={this.onJoinRuleChangeError}
                closeSettingsFn={this.props.closeSettingsFn}
                promptUpgrade={true}
            />
        </SettingsFieldset>;
    }

    private onJoinRuleChangeError = (error: Error) => {
        Modal.createTrackedDialog('Room not found', '', ErrorDialog, {
            title: _t("Failed to update the join rules"),
            description: error.message ?? _t("Unknown failure"),
        });
    };

    private onBeforeJoinRuleChange = async (joinRule: JoinRule): Promise<boolean> => {
        if (this.state.encrypted && joinRule === JoinRule.Public) {
            const dialog = Modal.createTrackedDialog('Confirm Public Encrypted Room', '', QuestionDialog, {
                title: _t("Are you sure you want to make this encrypted room public?"),
                description: <div>
                    <p> { _t(
                        "<b>It's not recommended to make encrypted rooms public.</b> " +
                        "It will mean anyone can find and join the room, so anyone can read messages. " +
                        "You'll get none of the benefits of encryption. Encrypting messages in a public " +
                        "room will make receiving and sending messages slower.",
                        null,
                        { "b": (sub) => <b>{ sub }</b> },
                    ) } </p>
                    <p> { _t(
                        "To avoid these issues, create a <a>new public room</a> for the conversation " +
                        "you plan to have.",
                        null,
                        {
                            "a": (sub) => <a
                                className="mx_linkButton"
                                onClick={() => {
                                    dialog.close();
                                    this.createNewRoom(true, false);
                                }}> { sub } </a>,
                        },
                    ) } </p>
                </div>,
            });

            const { finished } = dialog;
            const [confirm] = await finished;
            if (!confirm) return false;
        }

        return true;
    };

    private renderHistory() {
        if (!SettingsStore.getValue(UIFeature.RoomHistorySettings)) {
            return null;
        }

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

        const description = _t('Changes to who can read history will only apply to future messages in this room. ' +
        'The visibility of existing history will be unchanged.');

        return (<SettingsFieldset legend={_t("Who can read history?")} description={description}>
            <StyledRadioGroup
                name="historyVis"
                value={history}
                onChange={this.onHistoryRadioToggle}
                disabled={!canChangeHistory}
                definitions={options}
            />
        </SettingsFieldset>);
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

        const historySection = this.renderHistory();

        let advanced;
        if (room.getJoinRule() === JoinRule.Public) {
            advanced = (
                <>
                    <AccessibleButton
                        onClick={this.toggleAdvancedSection}
                        kind="link"
                        className="mx_SettingsTab_showAdvanced"
                    >
                        { this.state.showAdvancedSection ? _t("Hide advanced") : _t("Show advanced") }
                    </AccessibleButton>
                    { this.state.showAdvancedSection && this.renderAdvanced() }
                </>
            );
        }

        return (
            <div className="mx_SettingsTab mx_SecurityRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Security & Privacy") }</div>

                <SettingsFieldset legend={_t("Encryption")} description={_t("Once enabled, encryption cannot be disabled.")}>
                    <LabelledToggleSwitch
                        value={isEncrypted}
                        onChange={this.onEncryptionChange}
                        label={_t("Encrypted")}
                        disabled={!canEnableEncryption}
                    />
                    { encryptionSettings }
                </SettingsFieldset>

                { this.renderJoinRule() }

                { advanced }
                { historySection }
            </div>
        );
    }
}
