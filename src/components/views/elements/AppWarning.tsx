import React from 'react';

interface IProps {
    errorMsg?: string;
}

const AppWarning: React.FC<IProps> = (props) => {
    return (
        <div className='mx_AppPermissionWarning'>
            <div className='mx_AppPermissionWarningImage'>
                <img src={require("../../../../res/img/warning.svg")} alt='' />
            </div>
            <div className='mx_AppPermissionWarningText'>
                <span className='mx_AppPermissionWarningTextLabel'>{ props.errorMsg || "Error" }</span>
            </div>
        </div>
    );
};

export default AppWarning;
