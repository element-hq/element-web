/*
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

import React from 'react';
import FocusTrap from 'focus-trap-react';
import PropTypes from 'prop-types';

import { MatrixClient } from 'matrix-js-sdk';

import { KeyCode } from '../../../Keyboard';
import AccessibleButton from '../elements/AccessibleButton';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';

/**
 * Basic container for modal dialogs.
 *
 * Includes a div for the title, and a keypress handler which cancels the
 * dialog on escape.
 */
export default React.createClass({
    displayName: 'BaseDialog',

    propTypes: {
        // onFinished callback to call when Escape is pressed
        // Take a boolean which is true is the dialog was dismissed
        // with a positive / confirm action or false if it was
        // cancelled (from BaseDialog, this is always false).
        onFinished: PropTypes.func.isRequired,

        // called when a key is pressed
        onKeyDown: PropTypes.func,

        // CSS class to apply to dialog div
        className: PropTypes.string,

        // Title for the dialog.
        // (could probably actually be something more complicated than a string if desired)
        title: PropTypes.string.isRequired,

        // children should be the content of the dialog
        children: PropTypes.node,

        // Id of content element
        // If provided, this is used to add a aria-describedby attribute
        contentId: React.PropTypes.string,
    },

    childContextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getChildContext: function() {
        return {
            matrixClient: this._matrixClient,
        };
    },

    componentWillMount() {
        this._matrixClient = MatrixClientPeg.get();
    },

    _onKeyDown: function(e) {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
        if (e.keyCode === KeyCode.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    },

    _onCancelClick: function(e) {
        this.props.onFinished(false);
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        return (
            <FocusTrap onKeyDown={this._onKeyDown}
                className={this.props.className}
                role="dialog"
                aria-labelledby='mx_BaseDialog_title'
                // This should point to a node describing the dialog.
                // If we were about to completelly follow this recommendation we'd need to
                // make all the components relying on BaseDialog to be aware of it.
                // So instead we will use the whole content as the description.
                // Description comes first and if the content contains more text,
                // AT users can skip its presentation.
                aria-describedby={this.props.contentId}
            >
                <AccessibleButton onClick={this._onCancelClick}
                    className="mx_Dialog_cancelButton"
                >
                    <TintableSvg src="img/icons-close-button.svg" width="35" height="35" />
                </AccessibleButton>
                <div className={'mx_Dialog_title ' + this.props.titleClass} id='mx_BaseDialog_title'>
                    { this.props.title }
                </div>
                { this.props.children }
            </FocusTrap>
        );
    },
});
