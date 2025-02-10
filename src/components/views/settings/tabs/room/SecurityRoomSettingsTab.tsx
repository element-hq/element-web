/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import {
    GuestAccess,
    HistoryVisibility,
    JoinRule,
    type MatrixEvent,
    RoomStateEvent,
    type Room,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { InlineSpinner } from "@vector-im/compound-web";

import { Icon as WarningIcon } from "../../../../../../res/img/warning.svg";
import { _t } from "../../../../../languageHandler";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import Modal from "../../../../../Modal";
import QuestionDialog from "../../../dialogs/QuestionDialog";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import AccessibleButton from "../../../elements/AccessibleButton";
import SettingsFlag from "../../../elements/SettingsFlag";
import createRoom from "../../../../../createRoom";
import CreateRoomDialog from "../../../dialogs/CreateRoomDialog";
import JoinRuleSettings from "../../JoinRuleSettings";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import SettingsFieldset from "../../SettingsFieldset";
import ExternalLink from "../../../elements/ExternalLink";
import PosthogTrackers from "../../../../../PosthogTrackers";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsTab from "../SettingsTab";
import SdkConfig from "../../../../../SdkConfig";
import { shouldForceDisableEncryption } from "../../../../../utils/crypto/shouldForceDisableEncryption";
import { Caption } from "../../../typography/Caption";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../../../../../utils/crypto";

interface IProps {
    room: Room;
    closeSettingsFn: () => void;
}

interface IState {
    guestAccess: GuestAccess;
    history: HistoryVisibility;
    hasAliases: boolean;
    encrypted: boolean | null;
    showAdvancedSection: boolean;
}

export default class SecurityRoomSettingsTab extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        const state = this.props.room.currentState;

        this.state = {
            guestAccess: this.pullContentPropertyFromEvent<GuestAccess>(
                state?.getStateEvents(EventType.RoomGuestAccess, ""),
                "guest_access",
                GuestAccess.Forbidden,
            ),
            history: this.pullContentPropertyFromEvent<HistoryVisibility>(
                state?.getStateEvents(EventType.RoomHistoryVisibility, ""),
                "history_visibility",
                HistoryVisibility.Shared,
            ),
            hasAliases: false, // async loaded in componentDidMount
            encrypted: null, // async loaded in componentDidMount
            showAdvancedSection: false,
        };
    }

    public async componentDidMount(): Promise<void> {
        this.context.on(RoomStateEvent.Events, this.onStateEvent);

        this.setState({
            hasAliases: await this.hasAliases(),
            encrypted: Boolean(await this.context.getCrypto()?.isEncryptionEnabledInRoom(this.props.room.roomId)),
        });
    }

    private pullContentPropertyFromEvent<T>(event: MatrixEvent | null | undefined, key: string, defaultValue: T): T {
        return event?.getContent()[key] || defaultValue;
    }

    public componentWillUnmount(): void {
        this.context.removeListener(RoomStateEvent.Events, this.onStateEvent);
    }

    private onStateEvent = (e: MatrixEvent): void => {
        const refreshWhenTypes: EventType[] = [
            EventType.RoomJoinRules,
            EventType.RoomGuestAccess,
            EventType.RoomHistoryVisibility,
            EventType.RoomEncryption,
        ];
        if (refreshWhenTypes.includes(e.getType() as EventType)) this.forceUpdate();
    };

    private onEncryptionChange = async (): Promise<void> => {
        if (this.props.room.getJoinRule() === JoinRule.Public) {
            const dialog = Modal.createDialog(QuestionDialog, {
                title: _t("room_settings|security|enable_encryption_public_room_confirm_title"),
                description: (
                    <div>
                        <p>
                            {" "}
                            {_t(
                                "room_settings|security|enable_encryption_public_room_confirm_description_1",
                                undefined,
                                { b: (sub) => <strong>{sub}</strong> },
                            )}{" "}
                        </p>
                        <p>
                            {" "}
                            {_t(
                                "room_settings|security|enable_encryption_public_room_confirm_description_2",
                                undefined,
                                {
                                    a: (sub) => (
                                        <AccessibleButton
                                            kind="link_inline"
                                            onClick={() => {
                                                dialog.close();
                                                this.createNewRoom(false, true);
                                            }}
                                        >
                                            {" "}
                                            {sub}{" "}
                                        </AccessibleButton>
                                    ),
                                },
                            )}{" "}
                        </p>
                    </div>
                ),
            });

            const { finished } = dialog;
            const [confirm] = await finished;
            if (!confirm) return;
        }

        Modal.createDialog(QuestionDialog, {
            title: _t("room_settings|security|enable_encryption_confirm_title"),
            description: _t(
                "room_settings|security|enable_encryption_confirm_description",
                {},
                {
                    a: (sub) => <ExternalLink href={SdkConfig.get("help_encryption_url")}>{sub}</ExternalLink>,
                },
            ),
            onFinished: (confirm) => {
                if (!confirm) {
                    this.setState({ encrypted: false });
                    return;
                }

                const beforeEncrypted = this.state.encrypted;
                this.setState({ encrypted: true });
                this.context
                    .sendStateEvent(this.props.room.roomId, EventType.RoomEncryption, {
                        algorithm: MEGOLM_ENCRYPTION_ALGORITHM,
                    })
                    .catch((e) => {
                        logger.error(e);
                        this.setState({ encrypted: beforeEncrypted });
                    });
            },
        });
    };

    private onGuestAccessChange = (allowed: boolean): void => {
        const guestAccess = allowed ? GuestAccess.CanJoin : GuestAccess.Forbidden;
        const beforeGuestAccess = this.state.guestAccess;
        if (beforeGuestAccess === guestAccess) return;

        this.setState({ guestAccess });

        this.context
            .sendStateEvent(
                this.props.room.roomId,
                EventType.RoomGuestAccess,
                {
                    guest_access: guestAccess,
                },
                "",
            )
            .catch((e) => {
                logger.error(e);
                this.setState({ guestAccess: beforeGuestAccess });
            });
    };

    private createNewRoom = async (defaultPublic: boolean, defaultEncrypted: boolean): Promise<boolean> => {
        const modal = Modal.createDialog(CreateRoomDialog, { defaultPublic, defaultEncrypted });

        PosthogTrackers.trackInteraction("WebRoomSettingsSecurityTabCreateNewRoomButton");

        const [shouldCreate, opts] = await modal.finished;
        if (shouldCreate) {
            await createRoom(this.context, opts);
        }
        return shouldCreate;
    };

    private onHistoryRadioToggle = (history: HistoryVisibility): void => {
        const beforeHistory = this.state.history;
        if (beforeHistory === history) return;

        this.setState({ history: history });
        this.context
            .sendStateEvent(
                this.props.room.roomId,
                EventType.RoomHistoryVisibility,
                {
                    history_visibility: history,
                },
                "",
            )
            .catch((e) => {
                logger.error(e);
                this.setState({ history: beforeHistory });
            });
    };

    private updateBlacklistDevicesFlag = (checked: boolean): void => {
        this.props.room.setBlacklistUnverifiedDevices(checked);
    };

    private async hasAliases(): Promise<boolean> {
        const cli = this.context;
        const response = await cli.getLocalAliases(this.props.room.roomId);
        const localAliases = response.aliases;
        return Array.isArray(localAliases) && localAliases.length !== 0;
    }

    private renderJoinRule(): JSX.Element {
        const room = this.props.room;

        let aliasWarning: JSX.Element | undefined;
        if (room.getJoinRule() === JoinRule.Public && !this.state.hasAliases) {
            aliasWarning = (
                <div className="mx_SecurityRoomSettingsTab_warning">
                    <WarningIcon width={15} height={15} />
                    <span>{_t("room_settings|security|public_without_alias_warning")}</span>
                </div>
            );
        }
        const description = _t("room_settings|security|join_rule_description", {
            roomName: room.name,
        });

        let advanced: JSX.Element | undefined;
        if (room.getJoinRule() === JoinRule.Public) {
            advanced = (
                <div>
                    <AccessibleButton
                        onClick={this.toggleAdvancedSection}
                        kind="link"
                        className="mx_SettingsTab_showAdvanced"
                        aria-expanded={this.state.showAdvancedSection}
                    >
                        {this.state.showAdvancedSection ? _t("action|hide_advanced") : _t("action|show_advanced")}
                    </AccessibleButton>
                    {this.state.showAdvancedSection && this.renderAdvanced()}
                </div>
            );
        }

        return (
            <SettingsFieldset legend={_t("room_settings|access|title")} description={description}>
                <JoinRuleSettings
                    room={room}
                    beforeChange={this.onBeforeJoinRuleChange}
                    onError={this.onJoinRuleChangeError}
                    closeSettingsFn={this.props.closeSettingsFn}
                    promptUpgrade={true}
                    aliasWarning={aliasWarning}
                />
                {advanced}
            </SettingsFieldset>
        );
    }

    private onJoinRuleChangeError = (error: Error): void => {
        Modal.createDialog(ErrorDialog, {
            title: _t("room_settings|security|error_join_rule_change_title"),
            description: error.message ?? _t("room_settings|security|error_join_rule_change_unknown"),
        });
    };

    private onBeforeJoinRuleChange = async (joinRule: JoinRule): Promise<boolean> => {
        if (this.state.encrypted && joinRule === JoinRule.Public) {
            const dialog = Modal.createDialog(QuestionDialog, {
                title: _t("room_settings|security|encrypted_room_public_confirm_title"),
                description: (
                    <div>
                        <p>
                            {" "}
                            {_t("room_settings|security|encrypted_room_public_confirm_description_1", undefined, {
                                b: (sub) => <strong>{sub}</strong>,
                            })}{" "}
                        </p>
                        <p>
                            {" "}
                            {_t("room_settings|security|encrypted_room_public_confirm_description_2", undefined, {
                                a: (sub) => (
                                    <AccessibleButton
                                        kind="link_inline"
                                        onClick={(): void => {
                                            dialog.close();
                                            this.createNewRoom(true, false);
                                        }}
                                    >
                                        {" "}
                                        {sub}{" "}
                                    </AccessibleButton>
                                ),
                            })}{" "}
                        </p>
                    </div>
                ),
            });

            const { finished } = dialog;
            const [confirm] = await finished;
            if (!confirm) return false;
        }

        return true;
    };

    private renderHistory(): ReactNode {
        if (!SettingsStore.getValue(UIFeature.RoomHistorySettings)) {
            return null;
        }

        const client = this.context;
        const history = this.state.history;
        const state = this.props.room.currentState;
        const canChangeHistory = state?.mayClientSendStateEvent(EventType.RoomHistoryVisibility, client);

        const options = [
            {
                value: HistoryVisibility.Shared,
                label: _t("room_settings|security|history_visibility_shared"),
            },
            {
                value: HistoryVisibility.Invited,
                label: _t("room_settings|security|history_visibility_invited"),
            },
            {
                value: HistoryVisibility.Joined,
                label: _t("room_settings|security|history_visibility_joined"),
            },
        ];

        // World readable doesn't make sense for encrypted rooms
        if (!this.state.encrypted || history === HistoryVisibility.WorldReadable) {
            options.unshift({
                value: HistoryVisibility.WorldReadable,
                label: _t("room_settings|security|history_visibility_world_readable"),
            });
        }

        const description = _t("room_settings|security|history_visibility_warning");

        return (
            <SettingsFieldset legend={_t("room_settings|security|history_visibility_legend")} description={description}>
                <StyledRadioGroup
                    name="historyVis"
                    value={history}
                    onChange={this.onHistoryRadioToggle}
                    disabled={!canChangeHistory}
                    definitions={options}
                />
            </SettingsFieldset>
        );
    }

    private toggleAdvancedSection = (): void => {
        this.setState({ showAdvancedSection: !this.state.showAdvancedSection });
    };

    private renderAdvanced(): JSX.Element {
        const client = this.context;
        const guestAccess = this.state.guestAccess;
        const state = this.props.room.currentState;
        const canSetGuestAccess = state?.mayClientSendStateEvent(EventType.RoomGuestAccess, client);

        return (
            <div className="mx_SecurityRoomSettingsTab_advancedSection">
                <LabelledToggleSwitch
                    value={guestAccess === GuestAccess.CanJoin}
                    onChange={this.onGuestAccessChange}
                    disabled={!canSetGuestAccess}
                    label={_t("room_settings|visibility|guest_access_label")}
                />
                <p>{_t("room_settings|security|guest_access_warning")}</p>
            </div>
        );
    }

    public render(): React.ReactNode {
        const client = this.context;
        const room = this.props.room;
        const isEncrypted = this.state.encrypted;
        const isEncryptionLoading = isEncrypted === null;
        const hasEncryptionPermission = room.currentState.mayClientSendStateEvent(EventType.RoomEncryption, client);
        const isEncryptionForceDisabled = shouldForceDisableEncryption(client);
        const canEnableEncryption = !isEncrypted && !isEncryptionForceDisabled && hasEncryptionPermission;

        let encryptionSettings: JSX.Element | undefined;
        if (
            isEncrypted &&
            SettingsStore.canSetValue("blacklistUnverifiedDevices", this.props.room.roomId, SettingLevel.ROOM_DEVICE)
        ) {
            encryptionSettings = (
                <SettingsFlag
                    name="blacklistUnverifiedDevices"
                    level={SettingLevel.ROOM_DEVICE}
                    onChange={this.updateBlacklistDevicesFlag}
                    roomId={this.props.room.roomId}
                />
            );
        }

        const historySection = this.renderHistory();

        return (
            <SettingsTab>
                <SettingsSection heading={_t("room_settings|security|title")}>
                    <SettingsFieldset
                        legend={_t("settings|security|encryption_section")}
                        description={
                            isEncryptionForceDisabled && !isEncrypted
                                ? undefined
                                : _t("room_settings|security|encryption_permanent")
                        }
                    >
                        {isEncryptionLoading ? (
                            <InlineSpinner />
                        ) : (
                            <>
                                <LabelledToggleSwitch
                                    value={isEncrypted}
                                    onChange={this.onEncryptionChange}
                                    label={_t("common|encrypted")}
                                    disabled={!canEnableEncryption}
                                />
                                {isEncryptionForceDisabled && !isEncrypted && (
                                    <Caption>{_t("room_settings|security|encryption_forced")}</Caption>
                                )}
                                {encryptionSettings}
                            </>
                        )}
                    </SettingsFieldset>
                    {this.renderJoinRule()}
                    {historySection}
                </SettingsSection>
            </SettingsTab>
        );
    }
}
