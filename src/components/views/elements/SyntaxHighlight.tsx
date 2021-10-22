/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

import React from 'react';
import highlight from 'highlight.js';

import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IProps {
    className?: string;
    children?: React.ReactNode;
}

@replaceableComponent("views.elements.SyntaxHighlight")
export default class SyntaxHighlight extends React.Component<IProps> {
    private el: HTMLPreElement = null;

    constructor(props: IProps) {
        super(props);
    }

    // componentDidUpdate used here for reusability
    public componentDidUpdate(): void {
        if (this.el) highlight.highlightElement(this.el);
    }

    // call componentDidUpdate because _ref is fired on initial render
    // which does not fire componentDidUpdate
    private ref = (el: HTMLPreElement): void => {
        this.el = el;
        this.componentDidUpdate();
    };

    public render(): JSX.Element {
        const { className, children } = this.props;

        return <pre className={`${className} mx_SyntaxHighlight`} ref={this.ref}>
            <code>{ children }</code>
        </pre>;
    }
}

