/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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
import { EventType, MatrixEvent, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Button, Text } from "@vector-im/compound-web";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import Modal from "../../../Modal";
import { isValid3pidInvite } from "../../../RoomInvite";
import { Action } from "../../../dispatcher/actions";
import ErrorDialog from "../dialogs/ErrorDialog";
import BaseCard from "../right_panel/BaseCard";
import { Flex } from "../../utils/Flex";
import { SpaceScopeHeader } from "./SpaceScopeHeader";

interface IProps {
    event: MatrixEvent;
    onClose?: () => void;
}

interface IState {
    stateKey: string;
    roomId: string;
    displayName: string;
    invited: boolean;
    canKick: boolean;
    senderName: string;
}

export default class ThirdPartyMemberInfo extends React.Component<IProps, IState> {
    private readonly room: Room | null;

    public constructor(props: IProps) {
        super(props);

        this.room = MatrixClientPeg.safeGet().getRoom(this.props.event.getRoomId());
        const me = this.room?.getMember(MatrixClientPeg.safeGet().getSafeUserId());
        const powerLevels = this.room?.currentState.getStateEvents("m.room.power_levels", "");
        const senderId = this.props.event.getSender()!;

        let kickLevel = powerLevels ? powerLevels.getContent().kick : 50;
        if (typeof kickLevel !== "number") kickLevel = 50;

        const sender = this.room?.getMember(senderId);

        this.state = {
            stateKey: this.props.event.getStateKey()!,
            roomId: this.props.event.getRoomId()!,
            displayName: this.props.event.getContent().display_name,
            invited: true,
            canKick: me ? me.powerLevel > kickLevel : false,
            senderName: sender?.name ?? senderId,
        };
    }

    public componentDidMount(): void {
        MatrixClientPeg.safeGet().on(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        }
    }

    public onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() === EventType.RoomThirdPartyInvite && ev.getStateKey() === this.state.stateKey) {
            const newDisplayName = ev.getContent().display_name;
            const isInvited = isValid3pidInvite(ev);

            const newState = { invited: isInvited } as IState;
            if (newDisplayName) newState["displayName"] = newDisplayName;
            this.setState(newState);
        }
    };

    public onCancel = (): void => {
        dis.dispatch({
            action: Action.View3pidInvite,
            event: null,
        });
    };

    public onKickClick = (): void => {
        MatrixClientPeg.safeGet()
            .sendStateEvent(this.state.roomId, EventType.RoomThirdPartyInvite, {}, this.state.stateKey)
            .catch((err) => {
                logger.error(err);

                // Revert echo because of error
                this.setState({ invited: true });

                Modal.createDialog(ErrorDialog, {
                    title: _t("user_info|error_revoke_3pid_invite_title"),
                    description: _t("user_info|error_revoke_3pid_invite_description"),
                });
            });

        // Local echo
        this.setState({ invited: false });
    };

    public render(): React.ReactNode {
        let adminTools: JSX.Element | undefined;
        if (this.state.canKick && this.state.invited) {
            adminTools = (
                <Flex direction="column" as="section" justify="start" gap="var(--cpd-space-2x)">
                    <Text as="span" role="heading" size="lg" weight="semibold">
                        {_t("user_info|admin_tools_section")}
                    </Text>
                    <Button size="sm" kind="destructive" className="mx_MemberInfo_field" onClick={this.onKickClick}>
                        {_t("user_info|revoke_invite")}
                    </Button>
                </Flex>
            );
        }

        const scopeHeader: JSX.Element | undefined = this.room ? <SpaceScopeHeader room={this.room} /> : undefined;

        return (
            <BaseCard header={scopeHeader} onClose={this.props.onClose}>
                <Flex className="mx_ThirdPartyMemberInfo" direction="column" gap="var(--cpd-space-4x)">
                    <Flex direction="column" as="section" justify="start" gap="var(--cpd-space-2x)">
                        {/* same as userinfo name style */}
                        <Text as="span" role="heading" size="lg" weight="semibold">
                            {this.state.displayName}
                        </Text>
                        <Text as="span">{_t("user_info|invited_by", { sender: this.state.senderName })}</Text>
                    </Flex>
                    {adminTools}
                </Flex>
            </BaseCard>
        );
    }
}
