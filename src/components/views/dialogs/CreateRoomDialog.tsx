/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent, createRef, type KeyboardEvent, type SyntheticEvent } from "react";
import { type Room, RoomType, JoinRule, Preset, Visibility } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../../SdkConfig";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { checkUserIsAllowedToChangeEncryption, type IOpts } from "../../../createRoom";
import Field from "../elements/Field";
import RoomAliasField from "../elements/RoomAliasField";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "../dialogs/BaseDialog";
import JoinRuleDropdown from "../elements/JoinRuleDropdown";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { privateShouldBeEncrypted } from "../../../utils/rooms";
import SettingsStore from "../../../settings/SettingsStore";
import LabelledCheckbox from "../elements/LabelledCheckbox";

interface IProps {
    type?: RoomType;
    defaultPublic?: boolean;
    defaultName?: string;
    parentSpace?: Room;
    defaultEncrypted?: boolean;
    onFinished(proceed?: false): void;
    onFinished(proceed: true, opts: IOpts): void;
}

interface IState {
    /**
     * The selected room join rule.
     */
    joinRule: JoinRule;
    /**
     * Indicates whether the created room should have public visibility (ie, it should be
     * shown in the public room list). Only applicable if `joinRule` == `JoinRule.Knock`.
     */
    isPublicKnockRoom: boolean;
    /**
     * Indicates whether end-to-end encryption is enabled for the room.
     */
    isEncrypted: boolean;
    /**
     * The room name.
     */
    name: string;
    /**
     * The room topic.
     */
    topic: string;
    /**
     * The room alias.
     */
    alias: string;
    /**
     * Indicates whether the details section is open.
     */
    detailsOpen: boolean;
    /**
     * Indicates whether federation is disabled for the room.
     */
    noFederate: boolean;
    /**
     * Indicates whether the room name is valid.
     */
    nameIsValid: boolean;
    /**
     * Indicates whether the user can change encryption settings for the room.
     */
    canChangeEncryption: boolean;
}

export default class CreateRoomDialog extends React.Component<IProps, IState> {
    private readonly askToJoinEnabled: boolean;
    private readonly supportsRestricted: boolean;
    private nameField = createRef<Field>();
    private aliasField = createRef<RoomAliasField>();

    public constructor(props: IProps) {
        super(props);

        this.askToJoinEnabled = SettingsStore.getValue("feature_ask_to_join");
        this.supportsRestricted = !!this.props.parentSpace;

        let joinRule = JoinRule.Invite;
        if (this.props.defaultPublic) {
            joinRule = JoinRule.Public;
        } else if (this.supportsRestricted) {
            joinRule = JoinRule.Restricted;
        }

        const cli = MatrixClientPeg.safeGet();
        this.state = {
            isPublicKnockRoom: this.props.defaultPublic || false,
            isEncrypted: this.props.defaultEncrypted ?? privateShouldBeEncrypted(cli),
            joinRule,
            name: this.props.defaultName || "",
            topic: "",
            alias: "",
            detailsOpen: false,
            noFederate: SdkConfig.get().default_federate === false,
            nameIsValid: false,
            canChangeEncryption: false,
        };
    }

    private roomCreateOptions(): IOpts {
        const opts: IOpts = {};
        const createOpts: IOpts["createOpts"] = (opts.createOpts = {});
        opts.roomType = this.props.type;
        createOpts.name = this.state.name;

        if (this.state.joinRule === JoinRule.Public) {
            createOpts.visibility = Visibility.Public;
            createOpts.preset = Preset.PublicChat;
            opts.guestAccess = false;
            const { alias } = this.state;
            createOpts.room_alias_name = alias.substring(1, alias.indexOf(":"));
        } else {
            opts.encryption = this.state.isEncrypted;
        }

        if (this.state.topic) {
            createOpts.topic = this.state.topic;
        }
        if (this.state.noFederate) {
            createOpts.creation_content = { "m.federate": false };
        }

        opts.parentSpace = this.props.parentSpace;
        if (this.props.parentSpace && this.state.joinRule === JoinRule.Restricted) {
            opts.joinRule = JoinRule.Restricted;
        }

        if (this.state.joinRule === JoinRule.Knock) {
            opts.joinRule = JoinRule.Knock;
            createOpts.visibility = this.state.isPublicKnockRoom ? Visibility.Public : Visibility.Private;
        }

        return opts;
    }

    public componentDidMount(): void {
        const cli = MatrixClientPeg.safeGet();
        checkUserIsAllowedToChangeEncryption(cli, Preset.PrivateChat).then(({ allowChange, forcedValue }) =>
            this.setState((state) => ({
                canChangeEncryption: allowChange,
                // override with forcedValue if it is set
                isEncrypted: forcedValue ?? state.isEncrypted,
            })),
        );

        // move focus to first field when showing dialog
        this.nameField.current?.focus();
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(event);
        switch (action) {
            case KeyBindingAction.Enter:
                this.onOk();
                event.preventDefault();
                event.stopPropagation();
                break;
        }
    };

    private onOk = async (): Promise<void> => {
        if (!this.nameField.current) return;
        const activeElement = document.activeElement as HTMLElement;
        activeElement?.blur();
        await this.nameField.current.validate({ allowEmpty: false });
        if (this.aliasField.current) {
            await this.aliasField.current.validate({ allowEmpty: false });
        }
        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise<void>((resolve) => this.setState({}, resolve));
        if (this.state.nameIsValid && (!this.aliasField.current || this.aliasField.current.isValid)) {
            this.props.onFinished(true, this.roomCreateOptions());
        } else {
            let field: RoomAliasField | Field | null = null;
            if (!this.state.nameIsValid) {
                field = this.nameField.current;
            } else if (this.aliasField.current && !this.aliasField.current.isValid) {
                field = this.aliasField.current;
            }
            if (field) {
                field.focus();
                await field.validate({ allowEmpty: false, focused: true });
            }
        }
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onNameChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ name: ev.target.value });
    };

    private onTopicChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ topic: ev.target.value });
    };

    private onJoinRuleChange = (joinRule: JoinRule): void => {
        this.setState({ joinRule });
    };

    private onEncryptedChange = (isEncrypted: boolean): void => {
        this.setState({ isEncrypted });
    };

    private onAliasChange = (alias: string): void => {
        this.setState({ alias });
    };

    private onDetailsToggled = (ev: SyntheticEvent<HTMLDetailsElement>): void => {
        this.setState({ detailsOpen: (ev.target as HTMLDetailsElement).open });
    };

    private onNoFederateChange = (noFederate: boolean): void => {
        this.setState({ noFederate });
    };

    private onNameValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await CreateRoomDialog.validateRoomName(fieldState);
        this.setState({ nameIsValid: !!result.valid });
        return result;
    };

    private onIsPublicKnockRoomChange = (isPublicKnockRoom: boolean): void => {
        this.setState({ isPublicKnockRoom });
    };

    private static validateRoomName = withValidation({
        rules: [
            {
                key: "required",
                test: async ({ value }) => !!value,
                invalid: () => _t("create_room|name_validation_required"),
            },
        ],
    });

    public render(): React.ReactNode {
        const isVideoRoom = this.props.type === RoomType.ElementVideo || this.props.type === RoomType.UnstableCall;

        let aliasField: JSX.Element | undefined;
        if (this.state.joinRule === JoinRule.Public) {
            const domain = MatrixClientPeg.safeGet().getDomain()!;
            aliasField = (
                <div className="mx_CreateRoomDialog_aliasContainer">
                    <RoomAliasField
                        ref={this.aliasField}
                        onChange={this.onAliasChange}
                        domain={domain}
                        value={this.state.alias}
                    />
                </div>
            );
        }

        let publicPrivateLabel: JSX.Element | undefined;
        if (this.state.joinRule === JoinRule.Restricted) {
            publicPrivateLabel = (
                <p>
                    {_t(
                        "create_room|join_rule_restricted_label",
                        {},
                        {
                            SpaceName: () => (
                                <strong>{this.props.parentSpace?.name ?? _t("common|unnamed_space")}</strong>
                            ),
                        },
                    )}
                    &nbsp;
                    {_t("create_room|join_rule_change_notice")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Public && this.props.parentSpace) {
            publicPrivateLabel = (
                <p>
                    {_t(
                        "create_room|join_rule_public_parent_space_label",
                        {},
                        {
                            SpaceName: () => (
                                <strong>{this.props.parentSpace?.name ?? _t("common|unnamed_space")}</strong>
                            ),
                        },
                    )}
                    &nbsp;
                    {_t("create_room|join_rule_change_notice")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Public) {
            publicPrivateLabel = (
                <p>
                    {_t("create_room|join_rule_public_label")}
                    &nbsp;
                    {_t("create_room|join_rule_change_notice")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Invite) {
            publicPrivateLabel = (
                <p>
                    {_t("create_room|join_rule_invite_label")}
                    &nbsp;
                    {_t("create_room|join_rule_change_notice")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Knock) {
            publicPrivateLabel = <p>{_t("create_room|join_rule_knock_label")}</p>;
        }

        let visibilitySection: JSX.Element | undefined;
        if (this.state.joinRule === JoinRule.Knock) {
            visibilitySection = (
                <LabelledCheckbox
                    className="mx_CreateRoomDialog_labelledCheckbox"
                    label={_t("room_settings|security|publish_room")}
                    onChange={this.onIsPublicKnockRoomChange}
                    value={this.state.isPublicKnockRoom}
                />
            );
        }

        let e2eeSection: JSX.Element | undefined;
        if (this.state.joinRule !== JoinRule.Public) {
            let microcopy: string;
            if (privateShouldBeEncrypted(MatrixClientPeg.safeGet())) {
                if (this.state.canChangeEncryption) {
                    microcopy = isVideoRoom
                        ? _t("create_room|encrypted_video_room_warning")
                        : _t("create_room|encrypted_warning");
                } else {
                    microcopy = _t("create_room|encryption_forced");
                }
            } else {
                microcopy = _t("settings|security|e2ee_default_disabled_warning");
            }
            e2eeSection = (
                <React.Fragment>
                    <LabelledToggleSwitch
                        label={_t("create_room|encryption_label")}
                        onChange={this.onEncryptedChange}
                        value={this.state.isEncrypted}
                        className="mx_CreateRoomDialog_e2eSwitch" // for end-to-end tests
                        disabled={!this.state.canChangeEncryption}
                    />
                    <p>{microcopy}</p>
                </React.Fragment>
            );
        }

        let federateLabel = _t("create_room|unfederated_label_default_off");
        if (SdkConfig.get().default_federate === false) {
            // We only change the label if the default setting is different to avoid jarring text changes to the
            // user. They will have read the implications of turning this off/on, so no need to rephrase for them.
            federateLabel = _t("create_room|unfederated_label_default_on");
        }

        let title: string;
        if (isVideoRoom) {
            title = _t("create_room|title_video_room");
        } else if (this.props.parentSpace || this.state.joinRule === JoinRule.Knock) {
            title = _t("action|create_a_room");
        } else {
            title =
                this.state.joinRule === JoinRule.Public
                    ? _t("create_room|title_public_room")
                    : _t("create_room|title_private_room");
        }

        return (
            <BaseDialog
                className="mx_CreateRoomDialog"
                onFinished={this.props.onFinished}
                title={title}
                screenName="CreateRoom"
            >
                <form onSubmit={this.onOk} onKeyDown={this.onKeyDown}>
                    <div className="mx_Dialog_content">
                        <Field
                            ref={this.nameField}
                            label={_t("common|name")}
                            onChange={this.onNameChange}
                            onValidate={this.onNameValidate}
                            value={this.state.name}
                            className="mx_CreateRoomDialog_name"
                        />
                        <Field
                            label={_t("create_room|topic_label")}
                            onChange={this.onTopicChange}
                            value={this.state.topic}
                            className="mx_CreateRoomDialog_topic"
                        />

                        <JoinRuleDropdown
                            label={_t("create_room|room_visibility_label")}
                            labelInvite={_t("create_room|join_rule_invite")}
                            labelKnock={
                                this.askToJoinEnabled ? _t("room_settings|security|join_rule_knock") : undefined
                            }
                            labelPublic={_t("common|public_room")}
                            labelRestricted={
                                this.supportsRestricted ? _t("create_room|join_rule_restricted") : undefined
                            }
                            value={this.state.joinRule}
                            onChange={this.onJoinRuleChange}
                        />

                        {publicPrivateLabel}
                        {visibilitySection}
                        {e2eeSection}
                        {aliasField}
                        <details onToggle={this.onDetailsToggled} className="mx_CreateRoomDialog_details">
                            <summary className="mx_CreateRoomDialog_details_summary">
                                {this.state.detailsOpen ? _t("action|hide_advanced") : _t("action|show_advanced")}
                            </summary>
                            <LabelledToggleSwitch
                                label={_t("create_room|unfederated", {
                                    serverName: MatrixClientPeg.safeGet().getDomain(),
                                })}
                                onChange={this.onNoFederateChange}
                                value={this.state.noFederate}
                            />
                            <p>{federateLabel}</p>
                        </details>
                    </div>
                </form>
                <DialogButtons
                    primaryButton={
                        isVideoRoom ? _t("create_room|action_create_video_room") : _t("create_room|action_create_room")
                    }
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    }
}
