/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';

export default createReactClass({
    displayName: 'TopUnreadMessagesBar',

    propTypes: {
        onScrollUpClick: PropTypes.func,
        onCloseClick: PropTypes.func,
    },

    render: function() {
        return (
            <div className="mx_TopUnreadMessagesBar">
                <AccessibleButton className="mx_TopUnreadMessagesBar_scrollUp"
                    title={_t('Jump to first unread message.')}
                    onClick={this.props.onScrollUpClick}>
                </AccessibleButton>
                <AccessibleButton className="mx_TopUnreadMessagesBar_markAsRead"
                    title={_t('Mark all as read')}
                    onClick={this.props.onCloseClick}>
                </AccessibleButton>
            </div>
        );
    },
});
