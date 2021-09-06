
import React from 'react'; // eslint-disable-line no-unused-vars

//see src/resizer for the actual resizing code, this is just the DOM for the resize handle
interface IResizeHandleProps {
    vertical?: boolean;
    reverse?: boolean;
    id?: string;
    passRef?: React.RefObject<HTMLDivElement>;
}

const ResizeHandle: React.FC<IResizeHandleProps> = ({ vertical, reverse, id, passRef }) => {
    const classNames = ['mx_ResizeHandle'];
    if (vertical) {
        classNames.push('mx_ResizeHandle_vertical');
    } else {
        classNames.push('mx_ResizeHandle_horizontal');
    }
    if (reverse) {
        classNames.push('mx_ResizeHandle_reverse');
    }
    return (
        <div ref={passRef} className={classNames.join(' ')} data-id={id}><div /></div>
    );
};

export default ResizeHandle;
