/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { JoinRule, Visibility } from "matrix-js-sdk/src/matrix";

import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import DirectoryCustomisations from "../../../customisations/Directory";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

interface IProps {
    roomId: string;
    label?: string;
    canSetCanonicalAlias?: boolean;
}

interface IState {
    isRoomPublished: boolean;
}

export default class RoomPublishSetting extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            isRoomPublished: false,
        };
    }

    private showError(): void {
        Modal.createDialog(ErrorDialog, {
            title: _t("room_settings|general|error_publishing"),
            description: _t("room_settings|general|error_publishing_detail"),
        });
    }

    private onRoomPublishChange = (): void => {
        const valueBefore = this.state.isRoomPublished;
        const newValue = !valueBefore;
        this.setState({ isRoomPublished: newValue });
        const client = MatrixClientPeg.safeGet();

        client
            .setRoomDirectoryVisibility(this.props.roomId, newValue ? Visibility.Public : Visibility.Private)
            .catch(() => {
                this.showError();
                // Roll back the local echo on the change
                this.setState({ isRoomPublished: valueBefore });
            });
    };

    public componentDidMount(): void {
        const client = MatrixClientPeg.safeGet();
        client.getRoomDirectoryVisibility(this.props.roomId).then((result) => {
            this.setState({ isRoomPublished: result.visibility === "public" });
        });
    }

    public render(): React.ReactNode {
        const client = MatrixClientPeg.safeGet();

        const room = client.getRoom(this.props.roomId);
        const isRoomPublishable = room && room.getJoinRule() !== JoinRule.Invite;

        const enabled =
            (DirectoryCustomisations.requireCanonicalAliasAccessToPublish?.() === false ||
                this.props.canSetCanonicalAlias) &&
            (isRoomPublishable || this.state.isRoomPublished);

        return (
            <LabelledToggleSwitch
                value={this.state.isRoomPublished}
                onChange={this.onRoomPublishChange}
                disabled={!enabled}
                label={_t("room_settings|general|publish_toggle", {
                    domain: client.getDomain(),
                })}
            />
        );
    }
}
