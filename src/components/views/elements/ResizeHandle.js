
import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';

//see src/resizer for the actual resizing code, this is just the DOM for the resize handle
const ResizeHandle = (props) => {
    const classNames = ['mx_ResizeHandle'];
    if (props.vertical) {
        classNames.push('mx_ResizeHandle_vertical');
    } else {
        classNames.push('mx_ResizeHandle_horizontal');
    }
    if (props.reverse) {
        classNames.push('mx_ResizeHandle_reverse');
    }
    return (
        <div className={classNames.join(' ')} data-id={props.id}><div /></div>
    );
};

ResizeHandle.propTypes = {
    vertical: PropTypes.bool,
    reverse: PropTypes.bool,
    id: PropTypes.string,
};

export default ResizeHandle;
