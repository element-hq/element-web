/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { upgradeRoom } from "../../../utils/RoomUpgrade";
import BaseDialog from "./BaseDialog";
import ErrorDialog from "./ErrorDialog";
import DialogButtons from "../elements/DialogButtons";
import Spinner from "../elements/Spinner";

interface IProps {
    room: Room;
    onFinished(upgrade?: boolean): void;
}

interface IState {
    busy: boolean;
}

export default class RoomUpgradeDialog extends React.Component<IProps, IState> {
    private targetVersion?: string;

    public state = {
        busy: true,
    };

    public async componentDidMount(): Promise<void> {
        const recommended = await this.props.room.getRecommendedVersion();
        this.targetVersion = recommended.version;
        this.setState({ busy: false });
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onUpgradeClick = (): void => {
        this.setState({ busy: true });
        upgradeRoom(this.props.room, this.targetVersion!, false, false)
            .then(() => {
                this.props.onFinished(true);
            })
            .catch((err) => {
                Modal.createDialog(ErrorDialog, {
                    title: _t("room_settings|advanced|error_upgrade_title"),
                    description: err?.message ?? _t("room_settings|advanced|error_upgrade_description"),
                });
            })
            .finally(() => {
                this.setState({ busy: false });
            });
    };

    public render(): React.ReactNode {
        let buttons: JSX.Element;
        if (this.state.busy) {
            buttons = <Spinner />;
        } else {
            buttons = (
                <DialogButtons
                    primaryButton={_t("room_settings|advanced|upgrade_button", { version: this.targetVersion })}
                    primaryButtonClass="danger"
                    hasCancel={true}
                    onPrimaryButtonClick={this.onUpgradeClick}
                    onCancel={this.onCancelClick}
                />
            );
        }

        return (
            <BaseDialog
                className="mx_RoomUpgradeDialog"
                onFinished={this.props.onFinished}
                title={_t("room_settings|advanced|upgrade_dialog_title")}
                contentId="mx_Dialog_content"
                hasCancel={true}
            >
                <p>{_t("room_settings|advanced|upgrade_dialog_description")}</p>
                <ol>
                    <li>{_t("room_settings|advanced|upgrade_dialog_description_1")}</li>
                    <li>{_t("room_settings|advanced|upgrade_dialog_description_2")}</li>
                    <li>{_t("room_settings|advanced|upgrade_dialog_description_3")}</li>
                    <li>{_t("room_settings|advanced|upgrade_dialog_description_4")}</li>
                </ol>
                {buttons}
            </BaseDialog>
        );
    }
}
