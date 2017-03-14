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

import * as KeyCode from '../../../KeyCode';
import AccessibleButton from '../elements/AccessibleButton';
import sdk from '../../../index';

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
        onFinished: React.PropTypes.func.isRequired,

        // callback to call when Enter is pressed
        onEnterPressed: React.PropTypes.func,

        // CSS class to apply to dialog div
        className: React.PropTypes.string,

        // Title for the dialog.
        // (could probably actually be something more complicated than a string if desired)
        title: React.PropTypes.string.isRequired,

        // children should be the content of the dialog
        children: React.PropTypes.node,
    },

    _onKeyDown: function(e) {
        if (e.keyCode === KeyCode.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished();
        } else if (e.keyCode === KeyCode.ENTER) {
            if (this.props.onEnterPressed) {
                e.stopPropagation();
                e.preventDefault();
                this.props.onEnterPressed(e);
            }
        }
    },

    _onCancelClick: function(e) {
        this.props.onFinished();
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
                
        return (
            <div onKeyDown={this._onKeyDown} className={this.props.className}>
                <AccessibleButton onClick={this._onCancelClick}
                    className="mx_Dialog_cancelButton"
                >
                    <TintableSvg src="img/icons-close-button.svg" width="35" height="35" />
                </AccessibleButton>
                <div className='mx_Dialog_title'>
                    { this.props.title }
                </div>
                { this.props.children }
            </div>
        );
    },
});
