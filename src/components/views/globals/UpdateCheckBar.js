/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

'use strict';

import React from 'react';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';
import {updateCheckStatusEnum} from '../../../vector/platform/VectorBasePlatform';
import AccessibleButton from 'matrix-react-sdk/lib/components/views/elements/AccessibleButton';

const doneStatuses = [
    updateCheckStatusEnum.ERROR,
    updateCheckStatusEnum.NOTAVAILABLE,
];

export default React.createClass({
    propTypes: {
        status: React.PropTypes.oneOf(Object.values(updateCheckStatusEnum)).isRequired,
        // Currently for error detail but will be usable for download progress
        // once that is a thing that squirrel passes through electron.
        detail: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            detail: '',
        }
    },

    getStatusText: function() {
        switch(this.props.status) {
            case updateCheckStatusEnum.ERROR:
                return _t('Error encountered (%(errorDetail)s).', { errorDetail: this.props.detail });
            case updateCheckStatusEnum.CHECKING:
                return _t('Checking for an update...');
            case updateCheckStatusEnum.NOTAVAILABLE:
                return _t('No update available.');
            case updateCheckStatusEnum.DOWNLOADING:
                return _t('Downloading update...');
        }
    }
    ,

    hideToolbar: function() {
        PlatformPeg.get().stopUpdateCheck();
    },

    render: function() {
        const message = this.getStatusText();
        const warning = _t('Warning');

        let image;
        if (doneStatuses.includes(this.props.status)) {
            image = <img className="mx_MatrixToolbar_warning" src="img/warning.svg" width="24" height="23" alt={warning}/>;
        } else {
            image = <img className="mx_MatrixToolbar_warning" src="img/spinner.gif" width="24" height="23" alt={message}/>;
        }

        return (
            <div className="mx_MatrixToolbar">
                {image}
                <div className="mx_MatrixToolbar_content">
                    {message}
                </div>
                <AccessibleButton className="mx_MatrixToolbar_close" onClick={this.hideToolbar}>
                    <img src="img/cancel.svg" width="18" height="18" />
                </AccessibleButton>
            </div>
        );
    }
});
