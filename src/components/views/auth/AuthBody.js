/*
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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

export default class AuthBody extends React.PureComponent {
    static PropTypes = {
        header: PropTypes.bool,
    };

    static defaultProps = {
        header: true,
    };

    render() {
        const classes = {
            'mx_AuthBody': true,
            'mx_AuthBody_noHeader': !this.props.header,
        };

        return <div className={classnames(classes)}>
            { this.props.children }
        </div>;
    }
}
