/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd.
Copyright 2019 Bastian Masanek, Noxware IT <matrix@noxware.de>

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
import classNames from "classnames";

export default createReactClass({
    displayName: 'InfoDialog',
    propTypes: {
        className: PropTypes.string,
        title: PropTypes.string,
        description: PropTypes.node,
        button: PropTypes.string,
        onFinished: PropTypes.func,
        hasCloseButton: PropTypes.bool,
        onKeyDown: PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            title: '',
            description: '',
            hasCloseButton: false,
        };
    },

    onFinished: function() {
        this.props.onFinished();
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog
                className="mx_InfoDialog"
                onFinished={this.props.onFinished}
                title={this.props.title}
                contentId='mx_Dialog_content'
                hasCancel={this.props.hasCloseButton}
                onKeyDown={this.props.onKeyDown}
            >
                <div className={classNames("mx_Dialog_content", this.props.className)} id="mx_Dialog_content">
                    { this.props.description }
                </div>
                <DialogButtons primaryButton={this.props.button || _t('OK')}
                    onPrimaryButtonClick={this.onFinished}
                    hasCancel={false}
                >
                </DialogButtons>
            </BaseDialog>
        );
    },
});
