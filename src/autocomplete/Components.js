import React from 'react';

export function TextualCompletion({
    title,
    subtitle,
    description,
}: {
    title: ?string,
    subtitle: ?string,
    description: ?string
}) {
    return (
        <div className="mx_Autocomplete_Completion">
            <span>{title}</span>
            <em>{subtitle}</em>
            <span style={{color: 'gray', float: 'right'}}>{description}</span>
        </div>
    );
}
