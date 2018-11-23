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
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import SettingsStore from 'matrix-react-sdk/lib/settings/SettingsStore';

module.exports = React.createClass({
    displayName: 'VectorLoginFooter',
    statics: {
        replaces: 'LoginFooter',
    },

    render: function() {
        // FIXME: replace this with a proper Status skin
        // ...except then we wouldn't be able to switch to the Status theme at runtime.
        if (SettingsStore.getValue("theme") === 'status') return <div />;

        return (
            <div className="mx_Login_links">
                <a href="https://medium.com/@RiotChat">blog</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                <a href="https://twitter.com/@RiotChat">twitter</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                <a href="https://github.com/vector-im/riot-web">github</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                <a href="https://matrix.org">{ _t('powered by Matrix') }</a>
            </div>
        );
    },
});
