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

export default function(props) {
    const isWarning = props.status === "warning";
    const isVerified = props.status === "verified";
    const e2eIconClasses = classNames({
        mx_E2EIcon: true,
        mx_E2EIcon_warning: isWarning,
        mx_E2EIcon_verified: isVerified,
    }, props.className);
    let e2eTitle;
    if (isWarning) {
        e2eTitle = props.isUser ?
            _t("Some devices for this user are not trusted") :
            _t("Some devices in this encrypted room are not trusted");
    } else if (isVerified) {
        e2eTitle = props.isUser ?
            _t("All devices for this user are trusted") :
            _t("All devices in this encrypted room are trusted");
    }
    const icon = (<div className={e2eIconClasses} title={e2eTitle} />);
    if (props.onClick) {
        return (<AccessibleButton onClick={props.onClick}>{ icon }</AccessibleButton>);
    } else {
        return icon;
    }
}
