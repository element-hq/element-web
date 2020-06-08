/*
Copyright 2019 New Vector Ltd
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

import React, {useState} from "react";
import PropTypes from "prop-types";
import classNames from 'classnames';

import {_t, _td} from '../../../languageHandler';
import AccessibleButton from "../elements/AccessibleButton";
import Tooltip from "../elements/Tooltip";

export const E2E_STATE = {
    VERIFIED: "verified",
    WARNING: "warning",
    UNKNOWN: "unknown",
    NORMAL: "normal",
};

const crossSigningUserTitles = {
    [E2E_STATE.WARNING]: _td("This user has not verified all of their sessions."),
    [E2E_STATE.NORMAL]: _td("You have not verified this user."),
    [E2E_STATE.VERIFIED]: _td("You have verified this user. This user has verified all of their sessions."),
};
const crossSigningRoomTitles = {
    [E2E_STATE.WARNING]: _td("Someone is using an unknown session"),
    [E2E_STATE.NORMAL]: _td("This room is end-to-end encrypted"),
    [E2E_STATE.VERIFIED]: _td("Everyone in this room is verified"),
};

const E2EIcon = ({isUser, status, className, size, onClick, hideTooltip}) => {
    const [hover, setHover] = useState(false);

    const classes = classNames({
        mx_E2EIcon: true,
        mx_E2EIcon_warning: status === E2E_STATE.WARNING,
        mx_E2EIcon_normal: status === E2E_STATE.NORMAL,
        mx_E2EIcon_verified: status === E2E_STATE.VERIFIED,
    }, className);

    let e2eTitle;
    if (isUser) {
        e2eTitle = crossSigningUserTitles[status];
    } else {
        e2eTitle = crossSigningRoomTitles[status];
    }

    let style;
    if (size) {
        style = {width: `${size}px`, height: `${size}px`};
    }

    const onMouseOver = () => setHover(true);
    const onMouseOut = () => setHover(false);

    let tip;
    if (hover && !hideTooltip) {
        tip = <Tooltip label={e2eTitle ? _t(e2eTitle) : ""} />;
    }

    if (onClick) {
        return (
            <AccessibleButton
                onClick={onClick}
                onMouseOver={onMouseOver}
                onMouseOut={onMouseOut}
                className={classes}
                style={style}
            >
                { tip }
            </AccessibleButton>
        );
    }

    return <div onMouseOver={onMouseOver} onMouseOut={onMouseOut} className={classes} style={style}>
        { tip }
    </div>;
};

E2EIcon.propTypes = {
    isUser: PropTypes.bool,
    status: PropTypes.oneOf(Object.values(E2E_STATE)),
    className: PropTypes.string,
    size: PropTypes.number,
    onClick: PropTypes.func,
};

export default E2EIcon;
