/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import MatrixClientPeg from '../../../MatrixClientPeg';
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
    }

    componentWillUnmount() {
        const request = this.props.mxEvent.verificationRequest;
        if (request) {
            request.off("change", this._onRequestChanged);
        }
    }

    _onRequestChanged = () => {
        this.forceUpdate();
    };

    render() {
        const {mxEvent} = this.props;
        const request = mxEvent.verificationRequest;

        if (!request) {
            return null;
        }

        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();


        let title;

        if (request.done) {
            title = _t("You verified %(name)s", {name: getNameForEventRoom(request.otherUserId, mxEvent)});
        } else if (request.cancelled) {
            if (mxEvent.getSender() === myUserId) {
                title = _t("You cancelled verifying %(name)s",
                    {name: getNameForEventRoom(request.otherUserId, mxEvent)});
            } else if (mxEvent.getSender() === request.otherUserId) {
                title = _t("%(name)s cancelled verifying",
                    {name: getNameForEventRoom(request.otherUserId, mxEvent)});
            }
        } else {
            title = `request conclusion tile with phase ${request.phase}`;
        }

        if (title) {
            const subtitle = userLabelForEventRoom(request.otherUserId, mxEvent);
            const classes = classNames("mx_EventTile_bubble", "mx_KeyVerification", "mx_KeyVerification_icon", {
                mx_KeyVerification_icon_verified: request.done,
            });
            return (<div className={classes}>
                <div className="mx_KeyVerification_title">{title}</div>
                <div className="mx_KeyVerification_subtitle">{subtitle}</div>
            </div>);
        }

        return null;
    }
}

MKeyVerificationConclusion.propTypes = {
    /* the MatrixEvent to show */
    mxEvent: PropTypes.object.isRequired,
};
