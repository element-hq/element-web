/*
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
import { _t } from '../../../languageHandler';
import dis from "../../../dispatcher";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import DeviceListener from '../../../DeviceListener';
import FormButton from '../elements/FormButton';
import { replaceableComponent } from '../../../utils/replaceableComponent';

@replaceableComponent("views.toasts.UnverifiedSessionToast")
export default class UnverifiedSessionToast extends React.PureComponent {
    _onLaterClick = () => {
        DeviceListener.sharedInstance().dismissVerifications();
    };

    _onReviewClick = async () => {
        DeviceListener.sharedInstance().dismissVerifications();

        dis.dispatch({
            action: 'view_user_info',
            userId: MatrixClientPeg.get().getUserId(),
        });
    };

    render() {
        return (<div>
            <div className="mx_Toast_description">
                {_t("Verify your other sessions")}
            </div>
            <div className="mx_Toast_buttons" aria-live="off">
                <FormButton label={_t("Later")} kind="danger" onClick={this._onLaterClick} />
                <FormButton label={_t("Review")} onClick={this._onReviewClick} />
            </div>
        </div>);
    }
}
