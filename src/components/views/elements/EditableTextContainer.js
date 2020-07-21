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

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';

/**
 * A component which wraps an EditableText, with a spinner while updates take
 * place.
 *
 * Parent components should supply an 'onSubmit' callback which returns a
 * promise; a spinner is shown until the promise resolves.
 *
 * The parent can also supply a 'getInitialValue' callback, which works in a
 * similarly asynchronous way. If this is not provided, the initial value is
 * taken from the 'initialValue' property.
 */
export default class EditableTextContainer extends React.Component {
    constructor(props) {
        super(props);

        this._unmounted = false;
        this.state = {
            busy: false,
            errorString: null,
            value: props.initialValue,
        };
        this._onValueChanged = this._onValueChanged.bind(this);
    }

    componentDidMount() {
        if (this.props.getInitialValue === undefined) {
            // use whatever was given in the initialValue property.
            return;
        }

        this.setState({busy: true});

        this.props.getInitialValue().then(
            (result) => {
                if (this._unmounted) { return; }
                this.setState({
                    busy: false,
                    value: result,
                });
            },
            (error) => {
                if (this._unmounted) { return; }
                this.setState({
                    errorString: error.toString(),
                    busy: false,
                });
            },
        );
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _onValueChanged(value, shouldSubmit) {
        if (!shouldSubmit) {
            return;
        }

        this.setState({
            busy: true,
            errorString: null,
        });

        this.props.onSubmit(value).then(
            () => {
                if (this._unmounted) { return; }
                this.setState({
                    busy: false,
                    value: value,
                });
            },
            (error) => {
                if (this._unmounted) { return; }
                this.setState({
                    errorString: error.toString(),
                    busy: false,
                });
            },
        );
    }

    render() {
        if (this.state.busy) {
            const Loader = sdk.getComponent("elements.Spinner");
            return (
                <Loader />
            );
        } else if (this.state.errorString) {
            return (
                <div className="error">{ this.state.errorString }</div>
            );
        } else {
            const EditableText = sdk.getComponent('elements.EditableText');
            return (
                <EditableText initialValue={this.state.value}
                    placeholder={this.props.placeholder}
                    onValueChanged={this._onValueChanged}
                    blurToSubmit={this.props.blurToSubmit}
                />
            );
        }
    }
}

EditableTextContainer.propTypes = {
    /* callback to retrieve the initial value. */
    getInitialValue: PropTypes.func,

    /* initial value; used if getInitialValue is not given */
    initialValue: PropTypes.string,

    /* placeholder text to use when the value is empty (and not being
     * edited) */
    placeholder: PropTypes.string,

    /* callback to update the value. Called with a single argument: the new
     * value. */
    onSubmit: PropTypes.func,

    /* should the input submit when focus is lost? */
    blurToSubmit: PropTypes.bool,
};


EditableTextContainer.defaultProps = {
    initialValue: "",
    placeholder: "",
    blurToSubmit: false,
    onSubmit: function(v) {return Promise.resolve(); },
};
