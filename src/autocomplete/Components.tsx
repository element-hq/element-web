/*
Copyright 2016 Aviral Dasgupta

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, {forwardRef} from 'react';
import classNames from 'classnames';

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
    const {title, subtitle, description, className, ...restProps} = props;
    return (
        <div {...restProps}
             className={classNames('mx_Autocomplete_Completion_block', className)}
             role="option"
             ref={ref}
        >
            <span className="mx_Autocomplete_Completion_title">{ title }</span>
            <span className="mx_Autocomplete_Completion_subtitle">{ subtitle }</span>
            <span className="mx_Autocomplete_Completion_description">{ description }</span>
        </div>
    );
});

interface IPillCompletionProps extends ITextualCompletionProps {
    children?: React.ReactNode;
}

export const PillCompletion = forwardRef<IPillCompletionProps, any>((props, ref) => {
    const {title, subtitle, description, className, children, ...restProps} = props;
    return (
        <div {...restProps}
             className={classNames('mx_Autocomplete_Completion_pill', className)}
             role="option"
             ref={ref}
        >
            { children }
            <span className="mx_Autocomplete_Completion_title">{ title }</span>
            <span className="mx_Autocomplete_Completion_subtitle">{ subtitle }</span>
            <span className="mx_Autocomplete_Completion_description">{ description }</span>
        </div>
    );
});
