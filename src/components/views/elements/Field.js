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
        // The element to create. Defaults to "input".
        // Should be "input", "select", or "textarea".
        // To define options for a select, use <Field><option ... /></Field>
        element: PropTypes.string,
        // The field's type (when used as an <input>). Defaults to "text".
        type: PropTypes.string,
        // The field's label string.
        label: PropTypes.string,
        // The field's placeholder string. Defaults to the label.
        placeholder: PropTypes.string,
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
        const { element, children, ...inputProps } = this.props;

        const inputElement = element || "input";

        // Set some defaults for the <input> element
        inputProps.type = inputProps.type || "text";
        inputProps.ref = "fieldInput";
        inputProps.placeholder = inputProps.placeholder || inputProps.label;

        const fieldInput = React.createElement(inputElement, inputProps, children);

        return <div className={`mx_Field mx_Field_${inputElement}`}>
            {fieldInput}
            <label htmlFor={this.props.id}>{this.props.label}</label>
        </div>;
    }
}
