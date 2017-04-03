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

var React = require("react");
var counterpart = require('counterpart');
var Translate   = require('react-translate-component');

// load our own translations
counterpart.registerTranslations('en', require('../../../i18n/en-en'));
counterpart.registerTranslations('de', require('../../../i18n/de-de'));

module.exports = React.createClass({
    displayName: 'VectorCustomServerDialog',
    statics: {
        replaces: 'CustomServerDialog',
    },

    getInitialState: function() {
        var userLang = navigator.language || navigator.userLanguage;
        counterpart.setLocale(userLang);
        return null;
    },

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_Dialog_title">
                    { counterpart.translate('Custom Server Options') }
                </div>
                <div className="mx_Dialog_content">
                    <span>
                        { counterpart.translate('customServer_text') }
                    </span>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.props.onFinished} autoFocus={true}>
                        { counterpart.translate('Dismiss') }
                    </button>
                </div>
            </div>
        );
    }
});
