/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler } from "react";
import { JoinRule, Visibility } from "matrix-js-sdk/src/matrix";
import { SettingsToggleInput } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

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
    busy: boolean;
}

export default class RoomPublishSetting extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            isRoomPublished: false,
            busy: false,
        };
    }

    private showError(): void {
        Modal.createDialog(ErrorDialog, {
            title: _t("room_settings|general|error_publishing"),
            description: _t("room_settings|general|error_publishing_detail"),
        });
    }

    private onRoomPublishChange: ChangeEventHandler<HTMLInputElement> = async (evt): Promise<void> => {
        const newValue = evt.target.checked;
        this.setState({ busy: true });
        const client = MatrixClientPeg.safeGet();

        try {
            await client.setRoomDirectoryVisibility(
                this.props.roomId,
                newValue ? Visibility.Public : Visibility.Private,
            );
            this.setState({ isRoomPublished: newValue });
        } catch (ex) {
            logger.error("Error while setting room directory visibility", ex);
            this.showError();
        } finally {
            this.setState({ busy: false });
        }
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
        const canSetCanonicalAlias =
            DirectoryCustomisations.requireCanonicalAliasAccessToPublish?.() === false ||
            this.props.canSetCanonicalAlias;

        let disabledMessage;
        if (!isRoomPublishable) {
            disabledMessage = _t("room_settings|general|publish_warn_invite_only");
        } else if (!canSetCanonicalAlias) {
            disabledMessage = _t("room_settings|general|publish_warn_no_canonical_permission");
        }

        const enabled = canSetCanonicalAlias && (isRoomPublishable || this.state.isRoomPublished);

        return (
            <SettingsToggleInput
                name="room-publish"
                checked={this.state.isRoomPublished}
                onChange={this.onRoomPublishChange}
                disabled={!enabled || this.state.busy}
                disabledMessage={disabledMessage}
                label={_t("room_settings|general|publish_toggle", {
                    domain: client.getDomain(),
                })}
            />
        );
    }
}
