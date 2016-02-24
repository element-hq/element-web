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

var React = require('react');
var Notifier = require("matrix-react-sdk/lib/Notifier");
var sdk = require('matrix-react-sdk')

module.exports = React.createClass({
    displayName: 'MatrixToolbar',

    hideToolbar: function() {
        Notifier.setToolbarHidden(true);
    },

    onClick: function() {
        Notifier.setEnabled(true);
    },

    render: function() {
        return (
            <div className="mx_MatrixToolbar">
                <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt="/!\"/>
                <div>
                    You are not receiving desktop notifications. <a className="mx_MatrixToolbar_link" onClick={ this.onClick }>Enable them now</a>
                </div>
                <div className="mx_MatrixToolbar_close"><img src="img/cancel.svg" width="18" height="18" onClick={ this.hideToolbar } /></div>
            </div>
        );
    }
});

