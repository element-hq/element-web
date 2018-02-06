/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

const React = require('react');
import PropTypes from 'prop-types';

const MatrixClientPeg = require('../../../MatrixClientPeg');
const sdk = require('../../../index');
import AccessibleButton from '../elements/AccessibleButton';
import { _t } from '../../../languageHandler';


const PRESENCE_CLASS = {
    "offline": "mx_EntityTile_offline",
    "online": "mx_EntityTile_online",
    "unavailable": "mx_EntityTile_unavailable",
};


function presenceClassForMember(presenceState, lastActiveAgo) {
    // offline is split into two categories depending on whether we have
    // a last_active_ago for them.
    if (presenceState == 'offline') {
        if (lastActiveAgo) {
            return PRESENCE_CLASS['offline'] + '_beenactive';
        } else {
            return PRESENCE_CLASS['offline'] + '_neveractive';
        }
    } else if (presenceState) {
        return PRESENCE_CLASS[presenceState];
    } else {
        return PRESENCE_CLASS['offline'] + '_neveractive';
    }
}

const EntityTile = React.createClass({
    displayName: 'EntityTile',

    propTypes: {
        name: PropTypes.string,
        title: PropTypes.string,
        avatarJsx: PropTypes.any, // <BaseAvatar />
        className: PropTypes.string,
        presenceState: PropTypes.string,
        presenceLastActiveAgo: PropTypes.number,
        presenceLastTs: PropTypes.number,
        presenceCurrentlyActive: PropTypes.bool,
        showInviteButton: PropTypes.bool,
        shouldComponentUpdate: PropTypes.func,
        onClick: PropTypes.func,
        suppressOnHover: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            shouldComponentUpdate: function(nextProps, nextState) { return true; },
            onClick: function() {},
            presenceState: "offline",
            presenceLastActiveAgo: 0,
            presenceLastTs: 0,
            showInviteButton: false,
            suppressOnHover: false,
        };
    },

    getInitialState: function() {
        return {
            hover: false,
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        return this.props.shouldComponentUpdate(nextProps, nextState);
    },

    mouseEnter: function(e) {
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) {
        this.setState({ 'hover': false });
    },

    render: function() {
        const presenceClass = presenceClassForMember(
            this.props.presenceState, this.props.presenceLastActiveAgo,
        );

        let mainClassName = "mx_EntityTile ";
        mainClassName += presenceClass + (this.props.className ? (" " + this.props.className) : "");
        let nameEl;
        const {name} = this.props;

        const EmojiText = sdk.getComponent('elements.EmojiText');
        if (this.state.hover && !this.props.suppressOnHover) {
            const activeAgo = this.props.presenceLastActiveAgo ?
                (Date.now() - (this.props.presenceLastTs - this.props.presenceLastActiveAgo)) : -1;

            mainClassName += " mx_EntityTile_hover";
            const PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
            nameEl = (
                <div className="mx_EntityTile_details">
                    <img className="mx_EntityTile_chevron" src="img/member_chevron.png" width="8" height="12" />
                    <EmojiText element="div" className="mx_EntityTile_name mx_EntityTile_name_hover" dir="auto">
                        { name }
                    </EmojiText>
                    <PresenceLabel activeAgo={activeAgo}
                        currentlyActive={this.props.presenceCurrentlyActive}
                        presenceState={this.props.presenceState} />
                </div>
            );
        } else {
            nameEl = (
                <EmojiText element="div" className="mx_EntityTile_name" dir="auto">{ name }</EmojiText>
            );
        }

        let inviteButton;
        if (this.props.showInviteButton) {
            inviteButton = (
                <div className="mx_EntityTile_invite">
                    <img src="img/plus.svg" width="16" height="16" />
                </div>
            );
        }

        let power;
        const powerStatus = this.props.powerStatus;
        if (powerStatus) {
            const src = {
                [EntityTile.POWER_STATUS_MODERATOR]: "img/mod.svg",
                [EntityTile.POWER_STATUS_ADMIN]: "img/admin.svg",
            }[powerStatus];
            const alt = {
                [EntityTile.POWER_STATUS_MODERATOR]: _t("Moderator"),
                [EntityTile.POWER_STATUS_ADMIN]: _t("Admin"),
            }[powerStatus];
            power = <img src={src} className="mx_EntityTile_power" width="16" height="17" alt={alt} />;
        }

        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const av = this.props.avatarJsx || <BaseAvatar name={this.props.name} width={36} height={36} />;

        return (
            <AccessibleButton className={mainClassName} title={this.props.title}
                    onClick={this.props.onClick} onMouseEnter={this.mouseEnter}
                    onMouseLeave={this.mouseLeave}>
                <div className="mx_EntityTile_avatar">
                    { av }
                    { power }
                </div>
                { nameEl }
                { inviteButton }
            </AccessibleButton>
        );
    },
});

EntityTile.POWER_STATUS_MODERATOR = "moderator";
EntityTile.POWER_STATUS_ADMIN = "admin";


export default EntityTile;
