/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, createRef, KeyboardEvent, SyntheticEvent } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { JoinRule, Preset, Visibility } from "matrix-js-sdk/src/@types/partials";

import SdkConfig from "../../../SdkConfig";
import withValidation, { IFieldState, IValidationResult } from "../elements/Validation";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { IOpts } from "../../../createRoom";
import Field from "../elements/Field";
import RoomAliasField from "../elements/RoomAliasField";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import DialogButtons from "../elements/DialogButtons";
import BaseDialog from "../dialogs/BaseDialog";
import JoinRuleDropdown from "../elements/JoinRuleDropdown";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { privateShouldBeEncrypted } from "../../../utils/rooms";

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
    joinRule: JoinRule;
    isPublic: boolean;
    isEncrypted: boolean;
    name: string;
    topic: string;
    alias: string;
    detailsOpen: boolean;
    noFederate: boolean;
    nameIsValid: boolean;
    canChangeEncryption: boolean;
}

export default class CreateRoomDialog extends React.Component<IProps, IState> {
    private readonly supportsRestricted: boolean;
    private nameField = createRef<Field>();
    private aliasField = createRef<RoomAliasField>();

    public constructor(props: IProps) {
        super(props);

        this.supportsRestricted = !!this.props.parentSpace;

        let joinRule = JoinRule.Invite;
        if (this.props.defaultPublic) {
            joinRule = JoinRule.Public;
        } else if (this.supportsRestricted) {
            joinRule = JoinRule.Restricted;
        }

        const cli = MatrixClientPeg.get();
        this.state = {
            isPublic: this.props.defaultPublic || false,
            isEncrypted: this.props.defaultEncrypted ?? privateShouldBeEncrypted(cli),
            joinRule,
            name: this.props.defaultName || "",
            topic: "",
            alias: "",
            detailsOpen: false,
            noFederate: SdkConfig.get().default_federate === false,
            nameIsValid: false,
            canChangeEncryption: true,
        };

        cli.doesServerForceEncryptionForPreset(Preset.PrivateChat).then((isForced) =>
            this.setState({ canChangeEncryption: !isForced }),
        );
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
            // If we cannot change encryption we pass `true` for safety, the server should automatically do this for us.
            opts.encryption = this.state.canChangeEncryption ? this.state.isEncrypted : true;
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

        return opts;
    }

    public componentDidMount(): void {
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

    private static validateRoomName = withValidation({
        rules: [
            {
                key: "required",
                test: async ({ value }) => !!value,
                invalid: () => _t("Please enter a name for the room"),
            },
        ],
    });

    public render(): React.ReactNode {
        const isVideoRoom = this.props.type === RoomType.ElementVideo;

        let aliasField: JSX.Element | undefined;
        if (this.state.joinRule === JoinRule.Public) {
            const domain = MatrixClientPeg.get().getDomain()!;
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
                        "Everyone in <SpaceName/> will be able to find and join this room.",
                        {},
                        {
                            SpaceName: () => <b>{this.props.parentSpace?.name ?? _t("Unnamed Space")}</b>,
                        },
                    )}
                    &nbsp;
                    {_t("You can change this at any time from room settings.")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Public && this.props.parentSpace) {
            publicPrivateLabel = (
                <p>
                    {_t(
                        "Anyone will be able to find and join this room, not just members of <SpaceName/>.",
                        {},
                        {
                            SpaceName: () => <b>{this.props.parentSpace?.name ?? _t("Unnamed Space")}</b>,
                        },
                    )}
                    &nbsp;
                    {_t("You can change this at any time from room settings.")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Public) {
            publicPrivateLabel = (
                <p>
                    {_t("Anyone will be able to find and join this room.")}
                    &nbsp;
                    {_t("You can change this at any time from room settings.")}
                </p>
            );
        } else if (this.state.joinRule === JoinRule.Invite) {
            publicPrivateLabel = (
                <p>
                    {_t("Only people invited will be able to find and join this room.")}
                    &nbsp;
                    {_t("You can change this at any time from room settings.")}
                </p>
            );
        }

        let e2eeSection: JSX.Element | undefined;
        if (this.state.joinRule !== JoinRule.Public) {
            let microcopy: string;
            if (privateShouldBeEncrypted(MatrixClientPeg.get())) {
                if (this.state.canChangeEncryption) {
                    microcopy = isVideoRoom
                        ? _t("You can't disable this later. The room will be encrypted but the embedded call will not.")
                        : _t("You can't disable this later. Bridges & most bots won't work yet.");
                } else {
                    microcopy = _t("Your server requires encryption to be enabled in private rooms.");
                }
            } else {
                microcopy = _t(
                    "Your server admin has disabled end-to-end encryption by default " +
                        "in private rooms & Direct Messages.",
                );
            }
            e2eeSection = (
                <React.Fragment>
                    <LabelledToggleSwitch
                        label={_t("Enable end-to-end encryption")}
                        onChange={this.onEncryptedChange}
                        value={this.state.isEncrypted}
                        className="mx_CreateRoomDialog_e2eSwitch" // for end-to-end tests
                        disabled={!this.state.canChangeEncryption}
                    />
                    <p>{microcopy}</p>
                </React.Fragment>
            );
        }

        let federateLabel = _t(
            "You might enable this if the room will only be used for collaborating with internal " +
                "teams on your homeserver. This cannot be changed later.",
        );
        if (SdkConfig.get().default_federate === false) {
            // We only change the label if the default setting is different to avoid jarring text changes to the
            // user. They will have read the implications of turning this off/on, so no need to rephrase for them.
            federateLabel = _t(
                "You might disable this if the room will be used for collaborating with external " +
                    "teams who have their own homeserver. This cannot be changed later.",
            );
        }

        let title: string;
        if (isVideoRoom) {
            title = _t("Create a video room");
        } else if (this.props.parentSpace) {
            title = _t("Create a room");
        } else {
            title = this.state.joinRule === JoinRule.Public ? _t("Create a public room") : _t("Create a private room");
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
                            label={_t("Name")}
                            onChange={this.onNameChange}
                            onValidate={this.onNameValidate}
                            value={this.state.name}
                            className="mx_CreateRoomDialog_name"
                        />
                        <Field
                            label={_t("Topic (optional)")}
                            onChange={this.onTopicChange}
                            value={this.state.topic}
                            className="mx_CreateRoomDialog_topic"
                        />

                        <JoinRuleDropdown
                            label={_t("Room visibility")}
                            labelInvite={_t("Private room (invite only)")}
                            labelPublic={_t("Public room")}
                            labelRestricted={this.supportsRestricted ? _t("Visible to space members") : undefined}
                            value={this.state.joinRule}
                            onChange={this.onJoinRuleChange}
                        />

                        {publicPrivateLabel}
                        {e2eeSection}
                        {aliasField}
                        <details onToggle={this.onDetailsToggled} className="mx_CreateRoomDialog_details">
                            <summary className="mx_CreateRoomDialog_details_summary">
                                {this.state.detailsOpen ? _t("Hide advanced") : _t("Show advanced")}
                            </summary>
                            <LabelledToggleSwitch
                                label={_t("Block anyone not part of %(serverName)s from ever joining this room.", {
                                    serverName: MatrixClientPeg.getHomeserverName(),
                                })}
                                onChange={this.onNoFederateChange}
                                value={this.state.noFederate}
                            />
                            <p>{federateLabel}</p>
                        </details>
                    </div>
                </form>
                <DialogButtons
                    primaryButton={isVideoRoom ? _t("Create video room") : _t("Create room")}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    }
}
