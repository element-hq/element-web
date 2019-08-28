/*
Copyright 2017, 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { _t } from '../../../languageHandler';
import PlatformPeg from '../../../PlatformPeg';
import AccessibleButton from '../../../components/views/elements/AccessibleButton';

export default React.createClass({
    propTypes: {
        status: PropTypes.string.isRequired,
        // Currently for error detail but will be usable for download progress
        // once that is a thing that squirrel passes through electron.
        detail: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            detail: '',
        };
    },

    getStatusText: function() {
        // we can't import the enum from riot-web as we don't want matrix-react-sdk
        // to depend on riot-web. so we grab it as a normal object via API instead.
        const updateCheckStatusEnum = PlatformPeg.get().getUpdateCheckStatusEnum();
        switch (this.props.status) {
            case updateCheckStatusEnum.ERROR:
                return _t('Error encountered (%(errorDetail)s).', { errorDetail: this.props.detail });
            case updateCheckStatusEnum.CHECKING:
                return _t('Checking for an update...');
            case updateCheckStatusEnum.NOTAVAILABLE:
                return _t('No update available.');
            case updateCheckStatusEnum.DOWNLOADING:
                return _t('Downloading update...');
        }
    },

    hideToolbar: function() {
        PlatformPeg.get().stopUpdateCheck();
    },

    render: function() {
        const message = this.getStatusText();
        const warning = _t('Warning');

        if (!('getUpdateCheckStatusEnum' in PlatformPeg.get())) {
            return <div></div>;
        }

        const updateCheckStatusEnum = PlatformPeg.get().getUpdateCheckStatusEnum();
        const doneStatuses = [
            updateCheckStatusEnum.ERROR,
            updateCheckStatusEnum.NOTAVAILABLE,
        ];

        let image;
        if (doneStatuses.includes(this.props.status)) {
            image = <img className="mx_MatrixToolbar_warning" src={require("../../../../res/img/warning.svg")} width="24" height="23" alt="" />;
        } else {
            image = <img className="mx_MatrixToolbar_warning" src={require("../../../../res/img/spinner.gif")} width="24" height="23" alt="" />;
        }

        return (
            <div className="mx_MatrixToolbar">
                {image}
                <div className="mx_MatrixToolbar_content">
                    {message}
                </div>
                <AccessibleButton className="mx_MatrixToolbar_close" onClick={this.hideToolbar}>
                    <img src={require("../../../../res/img/cancel.svg")} width="18" height="18" alt={_t('Close')} />
                </AccessibleButton>
            </div>
        );
    },
});
