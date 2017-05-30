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

import React from 'react';
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'CustomServerDialog',

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_Dialog_title">
                    {_t("Custom Server Options")}
                </div>
                <div className="mx_Dialog_content">
                    <span>
                        {_t("You can use the custom server options to sign into other Matrix " +
                        "servers by specifying a different Home server URL.")}
                        <br/>
                        {_t("This allows you to use this app with an existing Matrix account on " +
                            "a different home server.")}
                        <br/>
                        <br/>
                        {_t("You can also set a custom identity server but this will typically prevent " +
                            "interaction with users based on email address.")}
                    </span>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.props.onFinished} autoFocus={true}>
                        {_t("Dismiss")}
                    </button>
                </div>
            </div>
        );
    }
});
