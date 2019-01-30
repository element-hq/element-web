import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

const AppWarning = (props) => {
    return (
        <div className='mx_AppPermissionWarning'>
            <div className='mx_AppPermissionWarningImage'>
                <img src={require("../../../../res/img/warning.svg")} alt='' />
            </div>
            <div className='mx_AppPermissionWarningText'>
                <span className='mx_AppPermissionWarningTextLabel'>{ props.errorMsg }</span>
            </div>
        </div>
    );
};

AppWarning.propTypes = {
    errorMsg: PropTypes.string,
};
AppWarning.defaultProps = {
    errorMsg: 'Error',
};

export default AppWarning;
