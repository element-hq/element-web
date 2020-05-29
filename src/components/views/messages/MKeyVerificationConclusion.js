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
import PropTypes from 'prop-types';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import {getNameForEventRoom, userLabelForEventRoom}
    from '../../../utils/KeyVerificationStateObserver';

export default class MKeyVerificationConclusion extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount() {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.on("change", this._onRequestChanged);
        }
        MatrixClientPeg.get().on("userTrustStatusChanged", this._onTrustChanged);
    }

    componentWillUnmount() {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.off("change", this._onRequestChanged);
        }
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("userTrustStatusChanged", this._onTrustChanged);
        }
    }

    _onRequestChanged = () => {
        this.forceUpdate();
    };

    _onTrustChanged = (userId, status) => {
        const { mxEvent } = this.props;
        const request = mxEvent.verificationRequest;
        if (!request || request.otherUserId !== userId) {
            return;
        }
        this.forceUpdate();
    };

    _shouldRender(mxEvent, request) {
        // normally should not happen
        if (!request) {
            return false;
        }
        // .cancel event that was sent after the verification finished, ignore
        if (mxEvent.getType() === "m.key.verification.cancel" && !request.cancelled) {
            return false;
        }
        // .done event that was sent after the verification cancelled, ignore
        if (mxEvent.getType() === "m.key.verification.done" && !request.done) {
            return false;
        }

        // request hasn't concluded yet
        if (request.pending) {
            return false;
        }

        // User isn't actually verified
        if (!MatrixClientPeg.get()
                            .checkUserTrust(request.otherUserId)
                            .isCrossSigningVerified()) {
            return false;
        }

        return true;
    }

    render() {
        const {mxEvent} = this.props;
        const request = mxEvent.verificationRequest;

        if (!this._shouldRender(mxEvent, request)) {
            return null;
        }

        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();

        let title;

        if (request.done) {
            title = _t("You verified %(name)s", {name: getNameForEventRoom(request.otherUserId, mxEvent)});
        } else if (request.cancelled) {
            const userId = request.cancellingUserId;
            if (userId === myUserId) {
                title = _t("You cancelled verifying %(name)s",
                    {name: getNameForEventRoom(request.otherUserId, mxEvent)});
            } else {
                title = _t("%(name)s cancelled verifying",
                    {name: getNameForEventRoom(userId, mxEvent)});
            }
        }

        if (title) {
            const subtitle = userLabelForEventRoom(request.otherUserId, mxEvent.getRoomId());
            const classes = classNames("mx_EventTile_bubble", "mx_cryptoEvent", "mx_cryptoEvent_icon", {
                mx_cryptoEvent_icon_verified: request.done,
            });
            return (<div className={classes}>
                <div className="mx_cryptoEvent_title">{title}</div>
                <div className="mx_cryptoEvent_subtitle">{subtitle}</div>
            </div>);
        }

        return null;
    }
}

MKeyVerificationConclusion.propTypes = {
    /* the MatrixEvent to show */
    mxEvent: PropTypes.object.isRequired,
};
