/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import RoomUpgradeDialog from "../dialogs/RoomUpgradeDialog";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    room: Room;
}

interface IState {
    upgraded?: boolean;
}

export default class RoomUpgradeWarningBar extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        const tombstone = this.props.room.currentState.getStateEvents("m.room.tombstone", "");
        this.state = {
            upgraded: tombstone?.getContent().replacement_room,
        };
    }

    public componentDidMount(): void {
        this.context.on(RoomStateEvent.Events, this.onStateEvents);
    }

    public componentWillUnmount(): void {
        this.context.removeListener(RoomStateEvent.Events, this.onStateEvents);
    }

    private onStateEvents = (event: MatrixEvent): void => {
        if (!this.props.room || event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        if (event.getType() !== "m.room.tombstone") return;

        const tombstone = this.props.room.currentState.getStateEvents("m.room.tombstone", "");
        this.setState({ upgraded: tombstone && tombstone.getContent().replacement_room });
    };

    private onUpgradeClick = (): void => {
        Modal.createDialog(RoomUpgradeDialog, { room: this.props.room });
    };

    public render(): React.ReactNode {
        let doUpgradeWarnings = (
            <div>
                <div className="mx_RoomUpgradeWarningBar_body">
                    <p>{_t("room|upgrade_warning_bar")}</p>
                    <p>
                        {_t(
                            "room_settings|advanced|room_upgrade_warning",
                            {},
                            {
                                b: (sub) => <strong>{sub}</strong>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                </div>
                <p className="mx_RoomUpgradeWarningBar_upgradelink">
                    <AccessibleButton onClick={this.onUpgradeClick}>
                        {_t("room_settings|advanced|room_upgrade_button")}
                    </AccessibleButton>
                </p>
            </div>
        );

        if (this.state.upgraded) {
            doUpgradeWarnings = (
                <div className="mx_RoomUpgradeWarningBar_body">
                    <p>{_t("room|upgrade_warning_bar_upgraded")}</p>
                </div>
            );
        }

        return (
            <div className="mx_RoomUpgradeWarningBar">
                <div className="mx_RoomUpgradeWarningBar_wrapped">
                    <div className="mx_RoomUpgradeWarningBar_header">
                        {_t(
                            "room|upgrade_warning_bar_unstable",
                            {},
                            {
                                roomVersion: () => <code>{this.props.room.getVersion()}</code>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </div>
                    {doUpgradeWarnings}
                    <div className="mx_RoomUpgradeWarningBar_small">{_t("room|upgrade_warning_bar_admins")}</div>
                </div>
            </div>
        );
    }
}
