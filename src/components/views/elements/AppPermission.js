/*
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import url from 'url';
import { _t } from '../../../languageHandler';
import WidgetUtils from "../../../utils/WidgetUtils";

export default class AppPermission extends React.Component {
    constructor(props) {
        super(props);

        const curlBase = this.getCurlBase();
        this.state = { curlBase: curlBase};
    }

    // Return string representation of content URL without query parameters
    getCurlBase() {
        const wurl = url.parse(this.props.url);
        let curl;
        let curlString;

        const searchParams = new URLSearchParams(wurl.search);

        if (WidgetUtils.isScalarUrl(wurl) && searchParams && searchParams.get('url')) {
            curl = url.parse(searchParams.get('url'));
            if (curl) {
                curl.search = curl.query = "";
                curlString = curl.format();
            }
        }
        if (!curl && wurl) {
            wurl.search = wurl.query = "";
            curlString = wurl.format();
        }
        return curlString;
    }

    render() {
        let e2eWarningText;
        if (this.props.isRoomEncrypted) {
            e2eWarningText =
                <span className='mx_AppPermissionWarningTextLabel'>{ _t('NOTE: Apps are not end-to-end encrypted') }</span>;
        }
        const cookieWarning =
            <span className='mx_AppPermissionWarningTextLabel'>
                { _t('Warning: This widget might use cookies.') }
            </span>;
        return (
            <div className='mx_AppPermissionWarning'>
                <div className='mx_AppPermissionWarningImage'>
                    <img src={require("../../../../res/img/feather-customised/warning-triangle.svg")} alt={_t('Warning!')} />
                </div>
                <div className='mx_AppPermissionWarningText'>
                    <span className='mx_AppPermissionWarningTextLabel'>{_t('Do you want to load widget from URL:')}</span>
                    <span className='mx_AppPermissionWarningTextURL'
                        title={this.state.curlBase}
                    >{this.state.curlBase}</span>
                    { e2eWarningText }
                    { cookieWarning }
                </div>
                <input
                    className='mx_AppPermissionButton'
                    type='button'
                    value={_t('Allow')}
                    onClick={this.props.onPermissionGranted}
                />
            </div>
        );
    }
}

AppPermission.propTypes = {
    isRoomEncrypted: PropTypes.bool,
    url: PropTypes.string.isRequired,
    onPermissionGranted: PropTypes.func.isRequired,
};
AppPermission.defaultProps = {
    isRoomEncrypted: false,
    onPermissionGranted: function() {},
};
