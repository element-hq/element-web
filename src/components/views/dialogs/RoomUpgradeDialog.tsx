/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";

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
                    description:
                        err && err.message ? err.message : _t("room_settings|advanced|error_upgrade_description"),
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
