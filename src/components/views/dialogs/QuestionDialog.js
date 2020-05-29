/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd.

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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'QuestionDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.node,
        extraButtons: PropTypes.node,
        button: PropTypes.string,
        danger: PropTypes.bool,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
        headerImage: PropTypes.string,
        quitOnly: PropTypes.bool, // quitOnly doesn't show the cancel button just the quit [x].
        fixedWidth: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            title: "",
            description: "",
            extraButtons: null,
            focus: true,
            hasCancelButton: true,
            danger: false,
            quitOnly: false,
        };
    },

    onOk: function() {
        this.props.onFinished(true);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        let primaryButtonClass = "";
        if (this.props.danger) {
            primaryButtonClass = "danger";
        }
        return (
            <BaseDialog
                className="mx_QuestionDialog"
                onFinished={this.props.onFinished}
                title={this.props.title}
                contentId='mx_Dialog_content'
                headerImage={this.props.headerImage}
                hasCancel={this.props.hasCancelButton}
                fixedWidth={this.props.fixedWidth}
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    { this.props.description }
                </div>
                <DialogButtons primaryButton={this.props.button || _t('OK')}
                    primaryButtonClass={primaryButtonClass}
                    cancelButton={this.props.cancelButton}
                    hasCancel={this.props.hasCancelButton && !this.props.quitOnly}
                    onPrimaryButtonClick={this.onOk}
                    focus={this.props.focus}
                    onCancel={this.onCancel}
                >
                    { this.props.extraButtons }
                </DialogButtons>
            </BaseDialog>
        );
    },
});
