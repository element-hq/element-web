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
import KeyVerificationStateObserver, {getNameForEventRoom, userLabelForEventRoom}
    from '../../../utils/KeyVerificationStateObserver';

export default class MKeyVerificationConclusion extends React.Component {
    constructor(props) {
        super(props);
        this.keyVerificationState = null;
        this.state = {
            done: false,
            cancelled: false,
            otherPartyUserId: null,
            cancelPartyUserId: null,
        };
        const rel = this.props.mxEvent.getRelation();
        if (rel) {
            const client = MatrixClientPeg.get();
            const room = client.getRoom(this.props.mxEvent.getRoomId());
            const requestEvent = room.findEventById(rel.event_id);
            if (requestEvent) {
                this._createStateObserver(requestEvent, client);
                this.state = this._copyState();
            } else {
                const findEvent = event => {
                    if (event.getId() === rel.event_id) {
                        this._createStateObserver(event, client);
                        this.setState(this._copyState());
                        room.removeListener("Room.timeline", findEvent);
                    }
                };
                room.on("Room.timeline", findEvent);
            }
        }
    }

    _createStateObserver(requestEvent, client) {
        this.keyVerificationState = new KeyVerificationStateObserver(requestEvent, client, () => {
            this.setState(this._copyState());
        });
    }

    _copyState() {
        const {done, cancelled, otherPartyUserId, cancelPartyUserId} = this.keyVerificationState;
        return {done, cancelled, otherPartyUserId, cancelPartyUserId};
    }

    componentDidMount() {
        if (this.keyVerificationState) {
            this.keyVerificationState.attach();
        }
    }

    componentWillUnmount() {
        if (this.keyVerificationState) {
            this.keyVerificationState.detach();
        }
    }

    _getName(userId) {
        const roomId = this.props.mxEvent.getRoomId();
        const client = MatrixClientPeg.get();
        const room = client.getRoom(roomId);
        const member = room.getMember(userId);
        return member ? member.name : userId;
    }

    _userLabel(userId) {
        const name = this._getName(userId);
        if (name !== userId) {
            return _t("%(name)s (%(userId)s)", {name, userId});
        } else {
            return userId;
        }
    }

    render() {
        const {mxEvent} = this.props;
        const client = MatrixClientPeg.get();
        const myUserId = client.getUserId();
        let title;

        if (this.state.done) {
            title = _t("You verified %(name)s", {name: getNameForEventRoom(this.state.otherPartyUserId, mxEvent)});
        } else if (this.state.cancelled) {
            if (mxEvent.getSender() === myUserId) {
                title = _t("You cancelled verifying %(name)s",
                    {name: getNameForEventRoom(this.state.otherPartyUserId, mxEvent)});
            } else if (mxEvent.getSender() === this.state.otherPartyUserId) {
                title = _t("%(name)s cancelled verifying",
                    {name: getNameForEventRoom(this.state.otherPartyUserId, mxEvent)});
            }
        }

        if (title) {
            const subtitle = userLabelForEventRoom(this.state.otherPartyUserId, mxEvent);
            const classes = classNames("mx_EventTile_bubble", "mx_KeyVerification", "mx_KeyVerification_icon", {
                mx_KeyVerification_icon_verified: this.state.done,
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
