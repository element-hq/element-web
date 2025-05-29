/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, type SyntheticEvent } from "react";
import { EventType, JoinRule } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import BugReportDialog from "./BugReportDialog";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import ProgressBar from "../elements/ProgressBar";
import AccessibleButton from "../elements/AccessibleButton";

export interface IFinishedOpts {
    continue: boolean;
    invite: boolean;
}

interface IProps {
    roomId: string;
    targetVersion: string;
    description?: ReactNode;
    doUpgrade?(opts: IFinishedOpts, fn: (progressText: string, progress: number, total: number) => void): Promise<void>;
    onFinished(opts?: IFinishedOpts): void;
}

interface Progress {
    text: string;
    progress: number;
    total: number;
}

interface IState {
    inviteUsersToNewRoom: boolean;
    progress?: Progress;
}

export default class RoomUpgradeWarningDialog extends React.Component<IProps, IState> {
    private readonly joinRule: JoinRule;
    private readonly isInviteOrKnockRoom: boolean;
    private readonly currentVersion?: string;

    public constructor(props: IProps) {
        super(props);

        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId);
        const joinRules = room?.currentState.getStateEvents(EventType.RoomJoinRules, "");
        this.joinRule = joinRules?.getContent()["join_rule"] ?? JoinRule.Invite;
        this.isInviteOrKnockRoom = [JoinRule.Invite, JoinRule.Knock].includes(this.joinRule);
        this.currentVersion = room?.getVersion();

        this.state = {
            inviteUsersToNewRoom: true,
        };
    }

    private onProgressCallback = (text: string, progress: number, total: number): void => {
        this.setState({
            progress: {
                text,
                progress,
                total,
            },
        });
    };

    private onContinue = async (): Promise<void> => {
        const opts = {
            continue: true,
            invite: this.isInviteOrKnockRoom && this.state.inviteUsersToNewRoom,
        };

        await this.props.doUpgrade?.(opts, this.onProgressCallback);
        this.props.onFinished(opts);
    };

    private onCancel = (): void => {
        this.props.onFinished({ continue: false, invite: false });
    };

    private onInviteUsersToggle = (inviteUsersToNewRoom: boolean): void => {
        this.setState({ inviteUsersToNewRoom });
    };

    private openBugReportDialog = (e: SyntheticEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        Modal.createDialog(BugReportDialog, {});
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let inviteToggle: JSX.Element | undefined;
        if (this.isInviteOrKnockRoom) {
            inviteToggle = (
                <LabelledToggleSwitch
                    value={this.state.inviteUsersToNewRoom}
                    onChange={this.onInviteUsersToggle}
                    label={_t("room_settings|advanced|upgrade_warning_dialog_invite_label")}
                />
            );
        }

        let title: string;
        switch (this.joinRule) {
            case JoinRule.Invite:
                title = _t("room_settings|advanced|upgrade_warning_dialog_title_private");
                break;
            case JoinRule.Public:
                title = _t("room_settings|advanced|upgrade_dwarning_ialog_title_public");
                break;
            default:
                title = _t("room_settings|advanced|upgrade_warning_dialog_title");
        }

        let bugReports = <p>{_t("room_settings|advanced|upgrade_warning_dialog_report_bug_prompt", { brand })}</p>;
        if (SdkConfig.get().bug_report_endpoint_url) {
            bugReports = (
                <p>
                    {_t(
                        "room_settings|advanced|upgrade_warning_dialog_report_bug_prompt_link",
                        {
                            brand,
                        },
                        {
                            a: (sub) => {
                                return (
                                    <AccessibleButton kind="link_inline" onClick={this.openBugReportDialog}>
                                        {sub}
                                    </AccessibleButton>
                                );
                            },
                        },
                    )}
                </p>
            );
        }

        let footer: JSX.Element;
        if (this.state.progress) {
            footer = (
                <span className="mx_RoomUpgradeWarningDialog_progress">
                    <ProgressBar value={this.state.progress.progress} max={this.state.progress.total} />
                    <div className="mx_RoomUpgradeWarningDialog_progressText">{this.state.progress.text}</div>
                </span>
            );
        } else {
            footer = (
                <DialogButtons
                    primaryButton={_t("action|upgrade")}
                    onPrimaryButtonClick={this.onContinue}
                    cancelButton={_t("action|cancel")}
                    onCancel={this.onCancel}
                />
            );
        }

        return (
            <BaseDialog
                className="mx_RoomUpgradeWarningDialog"
                hasCancel={true}
                fixedWidth={false}
                onFinished={this.props.onFinished}
                title={title}
            >
                <div>
                    <p>{this.props.description || _t("room_settings|advanced|upgrade_warning_dialog_description")}</p>
                    <p>
                        {_t(
                            "room_settings|advanced|upgrade_warning_dialog_explainer",
                            {},
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        )}
                    </p>
                    {bugReports}
                    <p>
                        {_t(
                            "room_settings|advanced|upgrade_warning_dialog_footer",
                            {},
                            {
                                oldVersion: () => <code>{this.currentVersion}</code>,
                                newVersion: () => <code>{this.props.targetVersion}</code>,
                            },
                        )}
                    </p>
                    {inviteToggle}
                </div>
                {footer}
            </BaseDialog>
        );
    }
}
