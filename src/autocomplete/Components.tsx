/*
Copyright 2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef } from "react";
import classNames from "classnames";

/* These were earlier stateless functional components but had to be converted
since we need to use refs/findDOMNode to access the underlying DOM node to focus the correct completion,
something that is not entirely possible with stateless functional components. One could
presumably wrap them in a <div> before rendering but I think this is the better way to do it.
 */

interface ITextualCompletionProps {
    title?: string;
    subtitle?: string;
    description?: string;
    className?: string;
}

export const TextualCompletion = forwardRef<ITextualCompletionProps, any>((props, ref) => {
    const { title, subtitle, description, className, "aria-selected": ariaSelectedAttribute, ...restProps } = props;
    return (
        <div
            {...restProps}
            className={classNames("mx_Autocomplete_Completion_block", className)}
            role="option"
            aria-selected={ariaSelectedAttribute}
            ref={ref}
        >
            <span className="mx_Autocomplete_Completion_title">{title}</span>
            <span className="mx_Autocomplete_Completion_subtitle">{subtitle}</span>
            <span className="mx_Autocomplete_Completion_description">{description}</span>
        </div>
    );
});

interface IPillCompletionProps extends ITextualCompletionProps {
    children?: React.ReactNode;
}

export const PillCompletion = forwardRef<IPillCompletionProps, any>((props, ref) => {
    const {
        title,
        subtitle,
        description,
        className,
        children,
        "aria-selected": ariaSelectedAttribute,
        ...restProps
    } = props;
    return (
        <div
            {...restProps}
            className={classNames("mx_Autocomplete_Completion_pill", className)}
            role="option"
            aria-selected={ariaSelectedAttribute}
            ref={ref}
        >
            {children}
            <span className="mx_Autocomplete_Completion_title">{title}</span>
            <span className="mx_Autocomplete_Completion_subtitle">{subtitle}</span>
            <span className="mx_Autocomplete_Completion_description">{description}</span>
        </div>
    );
});
