/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { Key, ReactElement, ReactInstance } from "react";
import ReactDom from "react-dom";

interface IChildProps {
    style: React.CSSProperties;
    ref: (node: React.ReactInstance) => void;
}

interface IProps {
    // either a list of child nodes, or a single child.
    children: React.ReactNode;

    // optional transition information for changing existing children
    transition?: object;

    // a list of state objects to apply to each child node in turn
    startStyles: React.CSSProperties[];
}

/**
 * The NodeAnimator contains components and animates transitions.
 * It will only pick up direct changes to properties ('left', currently), and so
 * will not work for animating positional changes where the position is implicit
 * from DOM order. This makes it a lot simpler and lighter: if you need fully
 * automatic positional animation, look at react-shuffle or similar libraries.
 */
export default class NodeAnimator extends React.Component<IProps> {
    private nodes: Record<string, ReactInstance> = {};
    private children: { [key: string]: ReactElement } = {};
    public static defaultProps: Partial<IProps> = {
        startStyles: [],
    };

    public constructor(props: IProps) {
        super(props);

        this.updateChildren(this.props.children);
    }

    public componentDidUpdate(): void {
        this.updateChildren(this.props.children);
    }

    /**
     *
     * @param {HTMLElement} node element to apply styles to
     * @param {React.CSSProperties} styles a key/value pair of CSS properties
     * @returns {void}
     */
    private applyStyles(node: HTMLElement, styles: React.CSSProperties): void {
        Object.entries(styles).forEach(([property, value]) => {
            node.style[property as keyof Omit<CSSStyleDeclaration, "length" | "parentRule">] = value;
        });
    }

    private updateChildren(newChildren: React.ReactNode): void {
        const oldChildren = this.children || {};
        this.children = {};
        React.Children.toArray(newChildren).forEach((c: ReactElement) => {
            if (oldChildren[c.key!]) {
                const old = oldChildren[c.key!];
                const oldNode = ReactDom.findDOMNode(this.nodes[old.key!]);

                if (oldNode && (oldNode as HTMLElement).style.left !== c.props.style.left) {
                    this.applyStyles(oldNode as HTMLElement, { left: c.props.style.left });
                }
                // clone the old element with the props (and children) of the new element
                // so prop updates are still received by the children.
                this.children[c.key!] = React.cloneElement(old, c.props, c.props.children);
            } else {
                // new element. If we have a startStyle, use that as the style and go through
                // the enter animations
                const newProps: Partial<IChildProps> = {};
                const restingStyle = c.props.style;

                const startStyles = this.props.startStyles;
                if (startStyles.length > 0) {
                    const startStyle = startStyles[0];
                    newProps.style = startStyle;
                }

                newProps.ref = (n) => this.collectNode(c.key!, n, restingStyle);

                this.children[c.key!] = React.cloneElement(c, newProps);
            }
        });
    }

    private collectNode(k: Key, node: React.ReactInstance, restingStyle: React.CSSProperties): void {
        if (node && this.nodes[k] === undefined && this.props.startStyles.length > 0) {
            const startStyles = this.props.startStyles;
            const domNode = ReactDom.findDOMNode(node);
            // start from startStyle 1: 0 is the one we gave it
            // to start with, so now we animate 1 etc.
            for (let i = 1; i < startStyles.length; ++i) {
                this.applyStyles(domNode as HTMLElement, startStyles[i]);
            }

            // and then we animate to the resting state
            window.setTimeout(() => {
                this.applyStyles(domNode as HTMLElement, restingStyle);
            }, 0);
        }
        this.nodes[k] = node;
    }

    public render(): React.ReactNode {
        return <>{Object.values(this.children)}</>;
    }
}
