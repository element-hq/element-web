import React, { useState } from 'react';
import BaseDialog from "../dialogs/BaseDialog";


interface Props {
    onFinished: () => void;
    onSubmit: (title: string, color: string) => void;
    displayBack?: boolean;
}

const colorOptions = [
    { label: 'Red', value: 'red' },
    { label: 'Green', value: 'green' },
    { label: 'Blue', value: 'blue' },
    { label: 'Yellow', value: 'yellow' },
    { label: 'Cyan', value: 'cyan' },
    { label: 'Magenta', value: 'magenta' },
    { label: 'Orange', value: 'orange' },
    { label: 'Purple', value: 'purple' },
    { label: 'Pink', value: 'pink' },
    { label: 'Brown', value: 'brown' },
];

const AnnotationDialog: React.FC<Props> = ({ onSubmit, onFinished }) => {

    const [title, setTitle] = useState('');
    const [color, setColor] = useState('red'); // Default color

    const handleSubmit = () => {
        onSubmit(title, color);
        onFinished();
    };

    return (
        <BaseDialog
        title="Annotation details"
        onFinished={onFinished}
        hasCancel={true}
        className="mx_WidgetCapabilitiesPromptDialog"
    >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
            />

            <div>
                <label htmlFor="colorSelect" style={{ marginRight: "10px" }}>Choose Color:</label>
                <select
                    id="colorSelect"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                >
                    {colorOptions.map((color) => (
                        <option key={color.value} value={color.value} style={{ backgroundColor: color.value }}>
                        {color.label}
                    </option>
                    ))}
                </select>
            </div>

            <button onClick={handleSubmit}>Submit</button>
        </div>
    </BaseDialog>
    );
};

export default AnnotationDialog;