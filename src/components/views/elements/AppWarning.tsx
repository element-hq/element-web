import React from 'react';

import WarningSvg from '../../../../res/img/warning.svg';

interface IProps {
    errorMsg?: string;
}

const AppWarning: React.FC<IProps> = (props) => {
    return (
        <div className='mx_AppPermissionWarning'>
            <div className='mx_AppPermissionWarningImage'>
                <img src={WarningSvg} alt='' />
            </div>
            <div className='mx_AppPermissionWarningText'>
                <span className='mx_AppPermissionWarningTextLabel'>{ props.errorMsg || "Error" }</span>
            </div>
        </div>
    );
};

export default AppWarning;
