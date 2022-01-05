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

import React from 'react';
import { MatrixEvent } from 'matrix-js-sdk/src';
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import { getNameForEventRoom, userLabelForEventRoom }
    from '../../../utils/KeyVerificationStateObserver';
import { RightPanelPhases } from '../../../stores/right-panel/RightPanelStorePhases';
import EventTileBubble from "./EventTileBubble";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AccessibleButton from '../elements/AccessibleButton';
import RightPanelStore from '../../../stores/right-panel/RightPanelStore';

interface IProps {
    mxEvent: MatrixEvent;
}

@replaceableComponent("views.messages.MKeyVerificationRequest")
export default class MKeyVerificationRequest extends React.Component<IProps> {
    public componentDidMount() {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.on("change", this.onRequestChanged);
        }
    }

    public componentWillUnmount() {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.off("change", this.onRequestChanged);
        }
    }

    private openRequest = () => {
        const { verificationRequest } = this.props.mxEvent;
        const member = MatrixClientPeg.get().getUser(verificationRequest.otherUserId);
        RightPanelStore.instance.setCards([
            { phase: RightPanelPhases.RoomSummary },
            { phase: RightPanelPhases.RoomMemberInfo, state: { member } },
            { phase: RightPanelPhases.EncryptionPanel, state: { verificationRequest, member } },
        ]);
    };

    private onRequestChanged = () => {
        this.forceUpdate();
    };

    private onAcceptClicked = async () => {
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

    private onRejectClicked = async () => {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            try {
                await request.cancel();
            } catch (err) {
                logger.error(err.message);
            }
        }
    };

    private acceptedLabel(userId: string) {
        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();
        if (userId === myUserId) {
            return _t("You accepted");
        } else {
            return _t("%(name)s accepted", { name: getNameForEventRoom(userId, this.props.mxEvent.getRoomId()) });
        }
    }

    private cancelledLabel(userId: string) {
        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();
        const { cancellationCode } = this.props.mxEvent.verificationRequest;
        const declined = cancellationCode === "m.user";
        if (userId === myUserId) {
            if (declined) {
                return _t("You declined");
            } else {
                return _t("You cancelled");
            }
        } else {
            if (declined) {
                return _t("%(name)s declined", { name: getNameForEventRoom(userId, this.props.mxEvent.getRoomId()) });
            } else {
                return _t("%(name)s cancelled", { name: getNameForEventRoom(userId, this.props.mxEvent.getRoomId()) });
            }
        }
    }

    public render() {
        const { mxEvent } = this.props;
        const request = mxEvent.verificationRequest;

        if (!request || request.invalid) {
            return null;
        }

        let title;
        let subtitle;
        let stateNode;

        if (!request.canAccept) {
            let stateLabel;
            const accepted = request.ready || request.started || request.done;
            if (accepted) {
                stateLabel = (<AccessibleButton onClick={this.openRequest}>
                    { this.acceptedLabel(request.receivingUserId) }
                </AccessibleButton>);
            } else if (request.cancelled) {
                stateLabel = this.cancelledLabel(request.cancellingUserId);
            } else if (request.accepting) {
                stateLabel = _t("Accepting …");
            } else if (request.declining) {
                stateLabel = _t("Declining …");
            }
            stateNode = (<div className="mx_cryptoEvent_state">{ stateLabel }</div>);
        }

        if (!request.initiatedByMe) {
            const name = getNameForEventRoom(request.requestingUserId, mxEvent.getRoomId());
            title = _t("%(name)s wants to verify", { name });
            subtitle = userLabelForEventRoom(request.requestingUserId, mxEvent.getRoomId());
            if (request.canAccept) {
                stateNode = (<div className="mx_cryptoEvent_buttons">
                    <AccessibleButton kind="danger" onClick={this.onRejectClicked}>
                        { _t("Decline") }
                    </AccessibleButton>
                    <AccessibleButton kind="primary" onClick={this.onAcceptClicked}>
                        { _t("Accept") }
                    </AccessibleButton>
                </div>);
            }
        } else { // request sent by us
            title = _t("You sent a verification request");
            subtitle = userLabelForEventRoom(request.receivingUserId, mxEvent.getRoomId());
        }

        if (title) {
            return <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={title}
                subtitle={subtitle}
            >
                { stateNode }
            </EventTileBubble>;
        }
        return null;
    }
}
