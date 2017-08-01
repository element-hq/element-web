import React from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';

function AppWarning(props) {
    return (
        <div className='mx_AppPermissionWarning'>
            <div className='mx_AppPermissionWarningImage'>
                <img src='img/warning.svg' alt={_t('Warning!')}/>
            </div>
            <div className='mx_AppPermissionWarningText'>
                <span className='mx_AppPermissionWarningTextLabel'>{props.errorMsg}</span>
            </div>
        </div>
    );
}

AppWarning.propTypes = {
    errorMsg: PropTypes.string,
};
AppWarning.defaultProps = {
    errorMsg: _t('Error'),
};

export default AppWarning;
