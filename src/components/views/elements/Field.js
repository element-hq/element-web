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

import React from 'react';
import PropTypes from 'prop-types';

export default class Field extends React.PureComponent {
    static propTypes = {
        // The field's ID, which binds the input and label together.
        id: PropTypes.string.isRequired,
        // The field's <input> type. Defaults to "text".
        type: PropTypes.string,
        // The field's label string.
        label: PropTypes.string,
        // The field's placeholder string.
        placeholder: PropTypes.string,
        // All other props pass through to the <input>.
    }

    render() {
        const extraProps = Object.assign({}, this.props);

        // Remove explicit props
        delete extraProps.id;
        delete extraProps.type;
        delete extraProps.placeholder;
        delete extraProps.label;

        return <div className="mx_Field">
            <input id={this.props.id}
                type={this.props.type || "text"}
                placeholder={this.props.placeholder}
                {...extraProps}
            />
            <label htmlFor={this.props.id}>{this.props.label}</label>
        </div>;
    }
}
