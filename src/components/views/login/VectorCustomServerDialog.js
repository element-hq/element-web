/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

const React = require("react");
const sanitizeHtml = require("sanitize-html");
import { _t } from 'matrix-react-sdk/lib/languageHandler';

module.exports = React.createClass({
    displayName: 'VectorCustomServerDialog',
    statics: {
        replaces: 'CustomServerDialog',
    },

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_Dialog_title">
                    { _t('Custom Server Options') }
                </div>
                <div className="mx_Dialog_content">
                    <span dangerouslySetInnerHTML={{__html: sanitizeHtml(_t(
                        "You can use the custom server options to sign into other Matrix "+
                        "servers by specifying a different Home server URL.<br/>This allows "+
                        "you to use Riot with an existing Matrix account on a different home "+
                        "server.<br/><br/>You can also set a custom identity server but you won't "+
                        "be able to invite users by email address, or be invited by email address yourself.",
                    ))}} />
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.props.onFinished} autoFocus={true}>
                        { _t('Dismiss') }
                    </button>
                </div>
            </div>
        );
    },
});
