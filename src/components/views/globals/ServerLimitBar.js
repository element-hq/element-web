/*
Copyright 2018 New Vector Ltd

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
import classNames from 'classnames';
import { _t } from '../../../languageHandler';

export default React.createClass({
    propTypes: {
        // 'hard' if the logged in user has been locked out, 'soft' if they haven't
        kind: PropTypes.string,
        adminContent: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            kind: 'hard',
        }
    },

    render: function() {
        const toolbarClasses = {
            'mx_MatrixToolbar': true,
        };
        let content;

        const translateLink = (sub) => {
            if (this.props.adminContent) {
                return <a href={this.props.adminContent}>{sub}</a>;
            } else {
                return sub;
            }
        }

        if (this.props.kind === 'hard') {
            toolbarClasses['mx_MatrixToolbar_error'] = true;
            content = _t(
                "This homeserver has hit its Monthly Active User limit. Please <a>contact your service administrator</a> to continue using the service.",
                {},
                {
                    'a': translateLink,
                },
            );
        } else {
            toolbarClasses['mx_MatrixToolbar_info'] = true;
            content = _t(
                "This homeserver has hit its Monthly Active User limit so some users will not be able to log in. Please <a>contact your service administrator</a> to get this limit increased.",
                {},
                {
                    'a': translateLink,
                },
            );
        }
        return (
            <div className={classNames(toolbarClasses)}>
                <div className="mx_MatrixToolbar_content">
                    { content }
                </div>
            </div>
        );
    },
});
