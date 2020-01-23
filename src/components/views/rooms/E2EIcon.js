/*
Copyright 2019 New Vector Ltd

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

import React from "react";
import PropTypes from "prop-types";
import classNames from 'classnames';

import {_t, _td} from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';
import SettingsStore from '../../../settings/SettingsStore';

export const E2E_STATE = {
    VERIFIED: "verified",
    WARNING: "warning",
    UNKNOWN: "unknown",
    NORMAL: "normal",
};

const crossSigningUserTitles = {
    [E2E_STATE.WARNING]: _td("This user has not verified all of their devices."),
    [E2E_STATE.NORMAL]: _td("You have not verified this user. This user has verified all of their devices."),
    [E2E_STATE.VERIFIED]: _td("You have verified this user. This user has verified all of their devices."),
};
const crossSigningRoomTitles = {
    [E2E_STATE.WARNING]: _td("Some users in this encrypted room are not verified by you or they have not verified " +
        "their own devices."),
    [E2E_STATE.VERIFIED]: _td("All users in this encrypted room are verified by you and they have verified their " +
        "own devices."),
};
const legacyUserTitles = {
    [E2E_STATE.WARNING]: _td("Some devices for this user are not trusted"),
    [E2E_STATE.VERIFIED]: _td("All devices for this user are trusted"),
};
const legacyRoomTitles = {
    [E2E_STATE.WARNING]: _td("Some devices in this encrypted room are not trusted"),
    [E2E_STATE.VERIFIED]: _td("All devices in this encrypted room are trusted"),
};

const E2EIcon = ({isUser, status, className, size, onClick}) => {
    const e2eIconClasses = classNames({
        mx_E2EIcon: true,
        mx_E2EIcon_warning: status === E2E_STATE.WARNING,
        mx_E2EIcon_normal: status === E2E_STATE.NORMAL,
        mx_E2EIcon_verified: status === E2E_STATE.VERIFIED,
    }, className);

    let e2eTitle;
    const crossSigning = SettingsStore.isFeatureEnabled("feature_cross_signing");
    if (crossSigning && isUser) {
        e2eTitle = crossSigningUserTitles[status];
    } else if (crossSigning && !isUser) {
        e2eTitle = crossSigningRoomTitles[status];
    } else if (!crossSigning && isUser) {
        e2eTitle = legacyUserTitles[status];
    } else if (!crossSigning && !isUser) {
        e2eTitle = legacyRoomTitles[status];
    }

    let style = null;
    if (size) {
        style = {width: `${size}px`, height: `${size}px`};
    }

    const icon = (<div className={e2eIconClasses} style={style} title={e2eTitle ? _t(e2eTitle) : undefined} />);
    if (onClick) {
        return (<AccessibleButton onClick={onClick}>{ icon }</AccessibleButton>);
    } else {
        return icon;
    }
};

E2EIcon.propTypes = {
    isUser: PropTypes.bool,
    status: PropTypes.oneOf(Object.values(E2E_STATE)),
    className: PropTypes.string,
    size: PropTypes.number,
    onClick: PropTypes.func,
};

export default E2EIcon;
