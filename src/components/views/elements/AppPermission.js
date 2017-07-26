import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';

export default class AppPermission extends React.Component {
    constructor(props) {
        super(props);

        const curl = this.getCurl();
        this.state = {
            curl: curl,
        };
        console.log('curl', curl);
    }

    getCurl() {
        const wurl = url.parse(this.props.url);
        let curl;

        const searchParams = new URLSearchParams(wurl.search);
        if(searchParams && searchParams.get('url')) {
            curl = searchParams.get('url');
        }
        curl = curl || wurl;
        return curl;
    }

    render() {
        return (
            <div className='mx_AppPermissionWarning'>
                <div className='mx_AppPermissionWarningImage'>
                    <img src='img/warning.svg' alt='Warning'/>
                </div>
                <div className='mx_AppPermissionWarningText'>
                    <span className='mx_AppPermissionWarningTextLabel'>Do you want to load widget from URL?:</span> <span className='mx_AppPermissionWarningTextURL'>{this.state.curl}</span>
                </div>
                <input
                    className='mx_AppPermissionButton'
                    type='button'
                    value='Allow'
                    onClick={this.props.onPermissionGranted}
                />
            </div>
        );
    }
}

AppPermission.propTypes = {
    url: PropTypes.string.isRequired,
    onPermissionGranted: PropTypes.func.isRequired,
};
AppPermission.defaultPropTypes = {
    onPermissionGranted: function() {},
};
