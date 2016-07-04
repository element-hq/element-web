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
        <div style={{width: '100%'}}>
            <span>{title}</span>
            <em>{subtitle}</em>
            <span style={{color: 'gray', float: 'right'}}>{description}</span>
        </div>
    );
}
