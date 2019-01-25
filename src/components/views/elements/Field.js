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
        // The field's placeholder string. Defaults to the label.
        placeholder: PropTypes.string,
        // The type of field to create. Defaults to "input". Should be "input" or "select".
        // To define options for a select, use <Field><option ... /></Field>
        element: PropTypes.string,
        // All other props pass through to the <input>.
    };

    get value() {
        if (!this.refs.fieldInput) return null;
        return this.refs.fieldInput.value;
    }

    set value(newValue) {
        if (!this.refs.fieldInput) {
            throw new Error("No field input reference");
        }
        this.refs.fieldInput.value = newValue;
    }

    render() {
        const extraProps = Object.assign({}, this.props);

        // Remove explicit properties that shouldn't be copied
        delete extraProps.element;
        delete extraProps.children;

        // Set some defaults for the element
        extraProps.type = extraProps.type || "text";
        extraProps.ref = "fieldInput";
        extraProps.placeholder = extraProps.placeholder || extraProps.label;

        const element = this.props.element || "input";
        const fieldInput = React.createElement(element, extraProps, this.props.children);

        return <div className="mx_Field">
            {fieldInput}
            <label htmlFor={this.props.id}>{this.props.label}</label>
        </div>;
    }
}
