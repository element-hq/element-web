/*
Copyright 2016 OpenMarket Ltd

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
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'TopUnreadMessagesBar',

    propTypes: {
        onScrollUpClick: React.PropTypes.func,
        onCloseClick: React.PropTypes.func,
    },

    render: function() {
        return (
            <div className="mx_TopUnreadMessagesBar">
                <div className="mx_TopUnreadMessagesBar_scrollUp"
                        onClick={this.props.onScrollUpClick}>
                    Jump to first unread message. <span style={{ textDecoration: 'underline' }} onClick={this.props.onCloseClick}>Mark all read</span>
                </div>
                <img className="mx_TopUnreadMessagesBar_close"
                    src="img/cancel.svg" width="18" height="18"
                    alt="Close" title="Close"
                    onClick={this.props.onCloseClick} />
            </div>
        );
    },
});

