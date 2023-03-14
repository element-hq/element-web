/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode, SyntheticEvent } from "react";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";

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
    private readonly isPrivate: boolean;
    private readonly currentVersion?: string;

    public constructor(props: IProps) {
        super(props);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        const joinRules = room?.currentState.getStateEvents(EventType.RoomJoinRules, "");
        this.isPrivate = joinRules?.getContent()["join_rule"] !== JoinRule.Public ?? true;
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
            invite: this.isPrivate && this.state.inviteUsersToNewRoom,
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
        if (this.isPrivate) {
            inviteToggle = (
                <LabelledToggleSwitch
                    value={this.state.inviteUsersToNewRoom}
                    onChange={this.onInviteUsersToggle}
                    label={_t("Automatically invite members from this room to the new one")}
                />
            );
        }

        const title = this.isPrivate ? _t("Upgrade private room") : _t("Upgrade public room");

        let bugReports = (
            <p>
                {_t(
                    "This usually only affects how the room is processed on the server. If you're " +
                        "having problems with your %(brand)s, please report a bug.",
                    { brand },
                )}
            </p>
        );
        if (SdkConfig.get().bug_report_endpoint_url) {
            bugReports = (
                <p>
                    {_t(
                        "This usually only affects how the room is processed on the server. If you're " +
                            "having problems with your %(brand)s, please <a>report a bug</a>.",
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
                    primaryButton={_t("Upgrade")}
                    onPrimaryButtonClick={this.onContinue}
                    cancelButton={_t("Cancel")}
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
                    <p>
                        {this.props.description ||
                            _t(
                                "Upgrading a room is an advanced action and is usually recommended when a room " +
                                    "is unstable due to bugs, missing features or security vulnerabilities.",
                            )}
                    </p>
                    <p>
                        {_t(
                            "<b>Please note upgrading will make a new version of the room</b>. " +
                                "All current messages will stay in this archived room.",
                            {},
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        )}
                    </p>
                    {bugReports}
                    <p>
                        {_t(
                            "You'll upgrade this room from <oldVersion /> to <newVersion />.",
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
