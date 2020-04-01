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

/*
 * Usage:
 * Modal.createTrackedDialog('An Identifier', 'some detail', ErrorDialog, {
 *   title: "some text", (default: "Error")
 *   description: "some more text",
 *   button: "Button Text",
 *   onFinished: someFunction,
 *   focus: true|false (default: true)
 * });
 */

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'ErrorDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.string,
        ]),
        button: PropTypes.string,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
        headerImage: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            focus: true,
            title: null,
            description: null,
            button: null,
        };
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog
                className="mx_ErrorDialog"
                onFinished={this.props.onFinished}
                title={this.props.title || _t('Error')}
                headerImage={this.props.headerImage}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    { this.props.description || _t('An error has occurred.') }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onFinished} autoFocus={this.props.focus}>
                        { this.props.button || _t('OK') }
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
