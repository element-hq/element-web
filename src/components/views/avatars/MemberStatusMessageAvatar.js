/*
Copyright 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import MemberAvatar from '../avatars/MemberAvatar';
import classNames from 'classnames';
import * as ContextualMenu from "../../structures/ContextualMenu";
import StatusMessageContextMenu from "../context_menus/StatusMessageContextMenu";
import SettingsStore from "../../../settings/SettingsStore";

export default class MemberStatusMessageAvatar extends React.Component {
    static propTypes = {
        member: PropTypes.object.isRequired,
        width: PropTypes.number,
        height: PropTypes.number,
        resizeMethod: PropTypes.string,
    };

    static defaultProps = {
        width: 40,
        height: 40,
        resizeMethod: 'crop',
    };

    constructor(props, context) {
        super(props, context);
    }

    componentWillMount() {
        if (this.props.member.userId !== MatrixClientPeg.get().getUserId()) {
            throw new Error("Cannot use MemberStatusMessageAvatar on anyone but the logged in user");
        }
    }

    componentDidMount() {
        MatrixClientPeg.get().on("RoomState.events", this._onRoomStateEvents);

        if (this.props.member.user) {
            this.setState({message: this.props.member.user._unstable_statusMessage});
        } else {
            this.setState({message: ""});
        }
    }

    componentWillUnmount() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this._onRoomStateEvents);
        }
    }

    _onRoomStateEvents = (ev, state) => {
        if (ev.getStateKey() !== MatrixClientPeg.get().getUserId()) return;
        if (ev.getType() !== "im.vector.user_status") return;
        // TODO: We should be relying on `this.props.member.user._unstable_statusMessage`
        // We don't currently because the js-sdk doesn't emit a specific event for this
        // change, and we don't want to race it. This should be improved when we rip out
        // the im.vector.user_status stuff and replace it with a complete solution.
        this.setState({message: ev.getContent()["status"]});
    };

    _onClick = (e) => {
        e.stopPropagation();

        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = (elementRect.left + window.pageXOffset) - (elementRect.width / 2) + 3;
        const chevronOffset = 12;
        let y = elementRect.top + (elementRect.height / 2) + window.pageYOffset;
        y = y - (chevronOffset + 4); // where 4 is 1/4 the height of the chevron

        ContextualMenu.createMenu(StatusMessageContextMenu, {
            chevronOffset: chevronOffset,
            chevronFace: 'bottom',
            left: x,
            top: y,
            menuWidth: 190,
            user: this.props.member.user,
        });
    };

    render() {
        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return <MemberAvatar member={this.props.member}
                                 width={this.props.width}
                                 height={this.props.height}
                                 resizeMethod={this.props.resizeMethod} />;
        }

        const hasStatus = this.props.member.user ? !!this.props.member.user._unstable_statusMessage : false;

        const classes = classNames({
            "mx_MemberStatusMessageAvatar": true,
            "mx_MemberStatusMessageAvatar_hasStatus": hasStatus,
        });

        return <AccessibleButton onClick={this._onClick} className={classes} element="div">
            <MemberAvatar member={this.props.member}
                          width={this.props.width}
                          height={this.props.height}
                          resizeMethod={this.props.resizeMethod} />
        </AccessibleButton>;
    }
}
