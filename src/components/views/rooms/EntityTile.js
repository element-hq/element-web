/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../../index';
import AccessibleButton from '../elements/AccessibleButton';
import { _t } from '../../../languageHandler';
import classNames from "classnames";
import E2EIcon from './E2EIcon';

const PRESENCE_CLASS = {
    "offline": "mx_EntityTile_offline",
    "online": "mx_EntityTile_online",
    "unavailable": "mx_EntityTile_unavailable",
};

function presenceClassForMember(presenceState, lastActiveAgo, showPresence) {
    if (showPresence === false) {
        return 'mx_EntityTile_online_beenactive';
    }

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

class EntityTile extends React.Component {
    static propTypes = {
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
        showPresence: PropTypes.bool,
        subtextLabel: PropTypes.string,
        e2eStatus: PropTypes.string,
    };

    static defaultProps = {
        shouldComponentUpdate: function(nextProps, nextState) { return true; },
        onClick: function() {},
        presenceState: "offline",
        presenceLastActiveAgo: 0,
        presenceLastTs: 0,
        showInviteButton: false,
        suppressOnHover: false,
        showPresence: true,
    };

    state = {
        hover: false,
    };

    shouldComponentUpdate(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        return this.props.shouldComponentUpdate(nextProps, nextState);
    }

    render() {
        const mainClassNames = {
            "mx_EntityTile": true,
            "mx_EntityTile_noHover": this.props.suppressOnHover,
        };
        if (this.props.className) mainClassNames[this.props.className] = true;

        const presenceClass = presenceClassForMember(
            this.props.presenceState, this.props.presenceLastActiveAgo, this.props.showPresence,
        );
        mainClassNames[presenceClass] = true;

        let nameEl;
        const {name} = this.props;

        if (!this.props.suppressOnHover) {
            const activeAgo = this.props.presenceLastActiveAgo ?
                (Date.now() - (this.props.presenceLastTs - this.props.presenceLastActiveAgo)) : -1;

            const PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
            let presenceLabel = null;
            if (this.props.showPresence) {
                presenceLabel = <PresenceLabel activeAgo={activeAgo}
                    currentlyActive={this.props.presenceCurrentlyActive}
                    presenceState={this.props.presenceState} />;
            }
            if (this.props.subtextLabel) {
                presenceLabel = <span className="mx_EntityTile_subtext">{this.props.subtextLabel}</span>;
            }
            nameEl = (
                <div className="mx_EntityTile_details">
                    <div className="mx_EntityTile_name" dir="auto">
                        { name }
                    </div>
                    {presenceLabel}
                </div>
            );
        } else if (this.props.subtextLabel) {
            nameEl = (
                <div className="mx_EntityTile_details">
                    <div className="mx_EntityTile_name" dir="auto">
                        {name}
                    </div>
                    <span className="mx_EntityTile_subtext">{this.props.subtextLabel}</span>
                </div>
            );
        } else {
            nameEl = (
                <div className="mx_EntityTile_name" dir="auto">{ name }</div>
            );
        }

        let inviteButton;
        if (this.props.showInviteButton) {
            inviteButton = (
                <div className="mx_EntityTile_invite">
                    <img src={require("../../../../res/img/plus.svg")} width="16" height="16" />
                </div>
            );
        }

        let powerLabel;
        const powerStatus = this.props.powerStatus;
        if (powerStatus) {
            const powerText = {
                [EntityTile.POWER_STATUS_MODERATOR]: _t("Mod"),
                [EntityTile.POWER_STATUS_ADMIN]: _t("Admin"),
            }[powerStatus];
            powerLabel = <div className="mx_EntityTile_power">{powerText}</div>;
        }

        let e2eIcon;
        const { e2eStatus } = this.props;
        if (e2eStatus) {
            e2eIcon = <E2EIcon status={e2eStatus} isUser={true} bordered={true} />;
        }

        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const av = this.props.avatarJsx ||
            <BaseAvatar name={this.props.name} width={36} height={36} aria-hidden="true" />;

        // The wrapping div is required to make the magic mouse listener work, for some reason.
        return (
            <div ref={(c) => this.container = c} >
                <AccessibleButton className={classNames(mainClassNames)} title={this.props.title}
                                  onClick={this.props.onClick}>
                    <div className="mx_EntityTile_avatar">
                        { av }
                        { e2eIcon }
                    </div>
                    { nameEl }
                    { powerLabel }
                    { inviteButton }
                </AccessibleButton>
            </div>
        );
    }
}

EntityTile.POWER_STATUS_MODERATOR = "moderator";
EntityTile.POWER_STATUS_ADMIN = "admin";

export default EntityTile;
