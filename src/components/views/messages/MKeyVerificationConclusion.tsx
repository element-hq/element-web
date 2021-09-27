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
import classNames from 'classnames';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import { getNameForEventRoom, userLabelForEventRoom } from '../../../utils/KeyVerificationStateObserver';
import EventTileBubble from "./EventTileBubble";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { EventType } from "matrix-js-sdk/src/@types/event";

interface IProps {
    /* the MatrixEvent to show */
    mxEvent: MatrixEvent;
}

@replaceableComponent("views.messages.MKeyVerificationConclusion")
export default class MKeyVerificationConclusion extends React.Component<IProps> {
    constructor(props: IProps) {
        super(props);
    }

    public componentDidMount(): void {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.on("change", this.onRequestChanged);
        }
        MatrixClientPeg.get().on("userTrustStatusChanged", this.onTrustChanged);
    }

    public componentWillUnmount(): void {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.off("change", this.onRequestChanged);
        }
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("userTrustStatusChanged", this.onTrustChanged);
        }
    }

    private onRequestChanged = (): void => {
        this.forceUpdate();
    };

    private onTrustChanged = (userId: string): void => {
        const { mxEvent } = this.props;
        const request = mxEvent.verificationRequest;
        if (!request || request.otherUserId !== userId) {
            return;
        }
        this.forceUpdate();
    };

    public static shouldRender(mxEvent: MatrixEvent, request: VerificationRequest): boolean {
        // normally should not happen
        if (!request) {
            return false;
        }
        // .cancel event that was sent after the verification finished, ignore
        if (mxEvent.getType() === EventType.KeyVerificationCancel && !request.cancelled) {
            return false;
        }
        // .done event that was sent after the verification cancelled, ignore
        if (mxEvent.getType() === EventType.KeyVerificationDone && !request.done) {
            return false;
        }

        // request hasn't concluded yet
        if (request.pending) {
            return false;
        }

        // User isn't actually verified
        if (!MatrixClientPeg.get().checkUserTrust(request.otherUserId).isCrossSigningVerified()) {
            return false;
        }

        return true;
    }

    public render(): JSX.Element {
        const { mxEvent } = this.props;
        const request = mxEvent.verificationRequest;

        if (!MKeyVerificationConclusion.shouldRender(mxEvent, request)) {
            return null;
        }

        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();

        let title;

        if (request.done) {
            title = _t(
                "You verified %(name)s",
                { name: getNameForEventRoom(request.otherUserId, mxEvent.getRoomId()) },
            );
        } else if (request.cancelled) {
            const userId = request.cancellingUserId;
            if (userId === myUserId) {
                title = _t("You cancelled verifying %(name)s",
                    { name: getNameForEventRoom(request.otherUserId, mxEvent.getRoomId()) });
            } else {
                title = _t("%(name)s cancelled verifying",
                    { name: getNameForEventRoom(userId, mxEvent.getRoomId()) });
            }
        }

        if (title) {
            const classes = classNames("mx_cryptoEvent mx_cryptoEvent_icon", {
                mx_cryptoEvent_icon_verified: request.done,
            });
            return <EventTileBubble
                className={classes}
                title={title}
                subtitle={userLabelForEventRoom(request.otherUserId, mxEvent.getRoomId())}
            />;
        }

        return null;
    }
}
