import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import { _t } from '../../../languageHandler';

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

        if(this.isScalarWurl(wurl) && searchParams && searchParams.get('url')) {
            curl = url.parse(searchParams.get('url'));
            if(curl) {
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

    isScalarWurl(wurl) {
        if(wurl && wurl.hostname && (
            wurl.hostname === 'scalar.vector.im' ||
            wurl.hostname === 'scalar-staging.riot.im' ||
            wurl.hostname === 'scalar-develop.riot.im' ||
            wurl.hostname === 'demo.riot.im' ||
            wurl.hostname === 'localhost'
        )) {
            return true;
        }
        return false;
    }

    render() {
        let e2eWarningText;
        if (this.props.isRoomEncrypted) {
            e2eWarningText =
                <span className='mx_AppPermissionWarningTextLabel'>{_t('NOTE: Apps are not end-to-end encrypted')}</span>;
        }
        return (
            <div className='mx_AppPermissionWarning'>
                <div className='mx_AppPermissionWarningImage'>
                    <img src='img/warning.svg' alt={_t('Warning!')}/>
                </div>
                <div className='mx_AppPermissionWarningText'>
                    <span className='mx_AppPermissionWarningTextLabel'>{_t('Do you want to load widget from URL:')}</span> <span className='mx_AppPermissionWarningTextURL'>{this.state.curlBase}</span>
                    {e2eWarningText}
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
