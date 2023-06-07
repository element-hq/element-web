/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent, User } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    Phase as VerificationPhase,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import { getNameForEventRoom, userLabelForEventRoom } from "../../../utils/KeyVerificationStateObserver";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EventTileBubble from "./EventTileBubble";
import AccessibleButton from "../elements/AccessibleButton";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";

interface IProps {
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

export default class MKeyVerificationRequest extends React.Component<IProps> {
    public componentDidMount(): void {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.on(VerificationRequestEvent.Change, this.onRequestChanged);
        }
    }

    public componentWillUnmount(): void {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.off(VerificationRequestEvent.Change, this.onRequestChanged);
        }
    }

    private openRequest = (): void => {
        let member: User | undefined;
        const { verificationRequest } = this.props.mxEvent;
        if (verificationRequest) {
            member = MatrixClientPeg.get().getUser(verificationRequest.otherUserId) ?? undefined;
        }
        RightPanelStore.instance.setCards([
            { phase: RightPanelPhases.RoomSummary },
            { phase: RightPanelPhases.RoomMemberInfo, state: { member } },
            { phase: RightPanelPhases.EncryptionPanel, state: { verificationRequest, member } },
        ]);
    };

    private onRequestChanged = (): void => {
        this.forceUpdate();
    };

    private onAcceptClicked = async (): Promise<void> => {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            try {
                this.openRequest();
                await request.accept();
            } catch (err) {
                logger.error(err.message);
            }
        }
    };

    private onRejectClicked = async (): Promise<void> => {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            try {
                await request.cancel();
            } catch (err) {
                logger.error(err.message);
            }
        }
    };

    private acceptedLabel(userId: string): string {
        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();
        if (userId === myUserId) {
            return _t("You accepted");
        } else {
            return _t("%(name)s accepted", {
                name: getNameForEventRoom(client, userId, this.props.mxEvent.getRoomId()!),
            });
        }
    }

    private cancelledLabel(userId: string): string {
        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();
        const cancellationCode = this.props.mxEvent.verificationRequest?.cancellationCode;
        const declined = cancellationCode === "m.user";
        if (userId === myUserId) {
            if (declined) {
                return _t("You declined");
            } else {
                return _t("You cancelled");
            }
        } else {
            if (declined) {
                return _t("%(name)s declined", {
                    name: getNameForEventRoom(client, userId, this.props.mxEvent.getRoomId()!),
                });
            } else {
                return _t("%(name)s cancelled", {
                    name: getNameForEventRoom(client, userId, this.props.mxEvent.getRoomId()!),
                });
            }
        }
    }

    public render(): React.ReactNode {
        const client = MatrixClientPeg.get();
        const { mxEvent } = this.props;
        const request = mxEvent.verificationRequest;

        if (!request || request.phase === VerificationPhase.Unsent) {
            return null;
        }

        let title: string;
        let subtitle: string;
        let stateNode: JSX.Element | undefined;

        if (!request.canAccept) {
            let stateLabel;
            const accepted =
                request.phase === VerificationPhase.Ready ||
                request.phase === VerificationPhase.Started ||
                request.phase === VerificationPhase.Done;
            if (accepted) {
                stateLabel = (
                    <AccessibleButton onClick={this.openRequest}>
                        {this.acceptedLabel(request.initiatedByMe ? request.otherUserId : client.getSafeUserId())}
                    </AccessibleButton>
                );
            } else if (request.phase === VerificationPhase.Cancelled) {
                stateLabel = this.cancelledLabel(request.cancellingUserId!);
            } else if (request.accepting) {
                stateLabel = _t("Accepting…");
            } else if (request.declining) {
                stateLabel = _t("Declining…");
            }
            stateNode = <div className="mx_cryptoEvent_state">{stateLabel}</div>;
        }

        if (!request.initiatedByMe) {
            const name = getNameForEventRoom(client, request.otherUserId, mxEvent.getRoomId()!);
            title = _t("%(name)s wants to verify", { name });
            subtitle = userLabelForEventRoom(client, request.otherUserId, mxEvent.getRoomId()!);
            if (request.canAccept) {
                stateNode = (
                    <div className="mx_cryptoEvent_buttons">
                        <AccessibleButton kind="danger" onClick={this.onRejectClicked}>
                            {_t("Decline")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onAcceptClicked}>
                            {_t("Accept")}
                        </AccessibleButton>
                    </div>
                );
            }
        } else {
            // request sent by us
            title = _t("You sent a verification request");
            subtitle = userLabelForEventRoom(client, request.otherUserId, mxEvent.getRoomId()!);
        }

        if (title) {
            return (
                <EventTileBubble
                    className="mx_cryptoEvent mx_cryptoEvent_icon"
                    title={title}
                    subtitle={subtitle}
                    timestamp={this.props.timestamp}
                >
                    {stateNode}
                </EventTileBubble>
            );
        }
        return null;
    }
}
