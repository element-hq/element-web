/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';
const sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'TopUnreadMessagesBar',

    propTypes: {
        onScrollUpClick: PropTypes.func,
        onCloseClick: PropTypes.func,
    },

    render: function() {
        return (
            <div className="mx_TopUnreadMessagesBar">
                <AccessibleButton className="mx_TopUnreadMessagesBar_scrollUp"
                        onClick={this.props.onScrollUpClick}>
                    <img src="img/scrollto.svg" width="24" height="24"
                        // No point on setting up non empty alt on this image
                        // as it only complements the text which follows it.
                        alt=""
                        title={_t('Scroll to unread messages')}
                        // In order not to use this title attribute for accessible name
                        // calculation of the parent button set the role presentation
                        role="presentation" />
                    { _t("Jump to first unread message.") }
                </AccessibleButton>
                <AccessibleButton element='img' className="mx_TopUnreadMessagesBar_close mx_filterFlipColor"
                    src="img/cancel.svg" width="18" height="18"
                    alt={_t("Close")} title={_t("Close")}
                    onClick={this.props.onCloseClick} />
            </div>
        );
    },
});
