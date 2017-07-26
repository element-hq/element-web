import React from 'react';
import PropTypes from 'prop-types';
import { URL, URLSearchParams } from 'url';

export default class AppPermission extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            curl: this.getCurl(),
        };
    }

    getCurl() {
        let wurl = URL.parse(this.props.url);
        console.log('wurl', wurl);
        if(wurl.searchParams.get('url')) {
            let curl = wurl.searchParams.get('url');
            console.log('curl', curl);
        }
    }

    render() {
        return (
            <div>
                Load widget with URL : {this.state.cUrl}
                <input
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
