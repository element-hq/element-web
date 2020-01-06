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

import classNames from 'classnames';
import { _t } from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';
import SettingsStore from '../../../settings/SettingsStore';

export default function(props) {
    const { isUser } = props;
    const isNormal = props.status === "normal";
    const isWarning = props.status === "warning";
    const isVerified = props.status === "verified";
    const e2eIconClasses = classNames({
        mx_E2EIcon: true,
        mx_E2EIcon_warning: isWarning,
        mx_E2EIcon_normal: isNormal,
        mx_E2EIcon_verified: isVerified,
    }, props.className);
    let e2eTitle;

    const crossSigning = SettingsStore.isFeatureEnabled("feature_cross_signing");
    if (crossSigning && isUser) {
        if (isWarning) {
            e2eTitle = _t(
                "This user has not verified all of their devices.",
            );
        } else if (isNormal) {
            e2eTitle = _t(
                "You have not verified this user. " +
                "This user has verified all of their devices.",
            );
        } else if (isVerified) {
            e2eTitle = _t(
                "You have verified this user. " +
                "This user has verified all of their devices.",
            );
        }
    } else if (crossSigning && !isUser) {
        if (isWarning) {
            e2eTitle = _t(
                "Some users in this encrypted room are not verified by you or " +
                "they have not verified their own devices.",
            );
        } else if (isVerified) {
            e2eTitle = _t(
                "All users in this encrypted room are verified by you and " +
                "they have verified their own devices.",
            );
        }
    } else if (!crossSigning && isUser) {
        if (isWarning) {
            e2eTitle = _t("Some devices for this user are not trusted");
        } else if (isVerified) {
            e2eTitle = _t("All devices for this user are trusted");
        }
    } else if (!crossSigning && !isUser) {
        if (isWarning) {
            e2eTitle = _t("Some devices in this encrypted room are not trusted");
        } else if (isVerified) {
            e2eTitle = _t("All devices in this encrypted room are trusted");
        }
    }

    let style = null;
    if (props.size) {
        style = {width: `${props.size}px`, height: `${props.size}px`};
    }

    const icon = (<div className={e2eIconClasses} style={style} title={e2eTitle} />);
    if (props.onClick) {
        return (<AccessibleButton onClick={props.onClick}>{ icon }</AccessibleButton>);
    } else {
        return icon;
    }
}
