/*
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

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
    public context!: React.ContextType<typeof MatrixClientContext>;

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
                    <p>
                        {_t(
                            "Upgrading this room will shut down the current instance of the room and create " +
                                "an upgraded room with the same name.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "<b>Warning</b>: upgrading a room will <i>not automatically migrate room members " +
                                "to the new version of the room.</i> We'll post a link to the new room in the old " +
                                "version of the room - room members will have to click this link to join the new room.",
                            {},
                            {
                                b: (sub) => <b>{sub}</b>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                </div>
                <p className="mx_RoomUpgradeWarningBar_upgradelink">
                    <AccessibleButton onClick={this.onUpgradeClick}>
                        {_t("Upgrade this room to the recommended room version")}
                    </AccessibleButton>
                </p>
            </div>
        );

        if (this.state.upgraded) {
            doUpgradeWarnings = (
                <div className="mx_RoomUpgradeWarningBar_body">
                    <p>{_t("This room has already been upgraded.")}</p>
                </div>
            );
        }

        return (
            <div className="mx_RoomUpgradeWarningBar">
                <div className="mx_RoomUpgradeWarningBar_wrapped">
                    <div className="mx_RoomUpgradeWarningBar_header">
                        {_t(
                            "This room is running room version <roomVersion />, which this homeserver has " +
                                "marked as <i>unstable</i>.",
                            {},
                            {
                                roomVersion: () => <code>{this.props.room.getVersion()}</code>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </div>
                    {doUpgradeWarnings}
                    <div className="mx_RoomUpgradeWarningBar_small">
                        {_t("Only room administrators will see this warning")}
                    </div>
                </div>
            </div>
        );
    }
}
