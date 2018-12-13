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
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import MemberAvatar from '../avatars/MemberAvatar';
import classNames from 'classnames';
import * as ContextualMenu from "../../structures/ContextualMenu";
import GenericElementContextMenu from "../context_menus/GenericElementContextMenu";

export default class MemberStatusMessageAvatar extends React.Component {
    constructor(props, context) {
        super(props, context);
        this._onRoomStateEvents = this._onRoomStateEvents.bind(this);
        this._onClick = this._onClick.bind(this);
        this._onClearClick = this._onClearClick.bind(this);
        this._onSubmit = this._onSubmit.bind(this);
        this._onStatusChange = this._onStatusChange.bind(this);
    }

    componentWillMount() {
        if (this.props.member.userId !== MatrixClientPeg.get().getUserId()) {
            throw new Error("Cannot use MemberStatusMessageAvatar on anyone but the logged in user");
        }
    }

    componentDidMount() {
        MatrixClientPeg.get().on("RoomState.events", this._onRoomStateEvents);

        if (this.props.member.user) {
            this.setState({message: this.props.member.user.statusMessage});
        } else {
            this.setState({message: ""});
        }
    }

    componentWillUnmount() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this._onRoomStateEvents);
        }
    }

    _onRoomStateEvents(ev, state) {
        if (ev.getStateKey() !== MatrixClientPeg.get().getUserId()) return;
        if (ev.getType() !== "im.vector.user_status") return;
        // TODO: We should be relying on `this.props.member.user.statusMessage`
        this.setState({message: ev.getContent()["status"]});
        this.forceUpdate();
    }

    _onClick(e) {
        e.stopPropagation();

        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = (elementRect.left + window.pageXOffset) - (elementRect.width / 2) + 3;
        const chevronOffset = 12;
        let y = elementRect.top + (elementRect.height / 2) + window.pageYOffset;
        y = y - (chevronOffset + 4); // where 4 is 1/4 the height of the chevron

        const contextMenu = this._renderContextMenu();

        ContextualMenu.createMenu(GenericElementContextMenu, {
            chevronOffset: chevronOffset,
            chevronFace: 'bottom',
            left: x,
            top: y,
            menuWidth: 190,
            element: contextMenu,
        });
    }

    async _onClearClick(e) {
        await MatrixClientPeg.get().setStatusMessage("");
        this.setState({message: ""});
    }

    _onSubmit(e) {
        e.preventDefault();
        MatrixClientPeg.get().setStatusMessage(this.state.message);
    }

    _onStatusChange(e) {
        this.setState({message: e.target.value});
    }

    _renderContextMenu() {
        const form = <form className="mx_MemberStatusMessageAvatar_contextMenu_form" onSubmit={this._onSubmit}>
            <input type="text" key="message" placeholder={_t("Set a new status...")}
                   className="mx_MemberStatusMessageAvatar_contextMenu_message"
                   defaultValue={this.state.message} onChange={this._onStatusChange} maxLength="60"
            />
            <AccessibleButton onClick={this._onSubmit} element="div" className="mx_MemberStatusMessageAvatar_contextMenu_submit">
                <img src="img/icons-checkmark.svg" width="22" height="22" />
            </AccessibleButton>
        </form>;

        const clearIcon = this.state.message ? "img/cancel-red.svg" : "img/cancel.svg";
        const clearButton = <AccessibleButton onClick={this._onClearClick} disabled={!this.state.message}
                                              className="mx_MemberStatusMessageAvatar_contextMenu_clear">
            <img src={clearIcon} alt={_t('Clear status')} width="12" height="12"
                 className="mx_filterFlipColor mx_MemberStatusMessageAvatar_contextMenu_clearIcon"
            />
            <span>{_t("Clear status")}</span>
        </AccessibleButton>;

        const menuClasses = classNames({
            "mx_MemberStatusMessageAvatar_contextMenu": true,
            "mx_MemberStatusMessageAvatar_contextMenu_hasStatus": this.state.message,
        });

        return <div className={menuClasses}>
            { form }
            <hr />
            { clearButton }
        </div>;
    }

    render() {
        const hasStatus = this.props.member.user ? !!this.props.member.user.statusMessage : false;

        const classes = classNames({
            "mx_MemberStatusMessageAvatar": true,
            "mx_MemberStatusMessageAvatar_hasStatus": hasStatus,
        });

        return <AccessibleButton onClick={this._onClick} className={classes} element="div">
            <MemberAvatar member={this.props.member}
                          width={this.props.width}
                          height={this.props.height}
                          resizeMethod={this.props.resizeMethod}
            />
        </AccessibleButton>;
    }
}

MemberStatusMessageAvatar.propTypes = {
    member: PropTypes.object.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    resizeMethod: PropTypes.string,
};

MemberStatusMessageAvatar.defaultProps = {
    width: 40,
    height: 40,
    resizeMethod: 'crop',
};
