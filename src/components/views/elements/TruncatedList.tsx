/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

import { _t } from "../../../languageHandler";

interface IProps {
    // The number of elements to show before truncating. If negative, no truncation is done.
    truncateAt: number;
    // The className to apply to the wrapping div
    className?: string;
    // A function that returns the children to be rendered into the element.
    // The start element is included, the end is not (as in `slice`).
    // If omitted, the React child elements will be used. This parameter can be used
    // to avoid creating unnecessary React elements.
    getChildren?: (start: number, end: number) => Array<React.ReactNode>;
    // A function that should return the total number of child element available.
    // Required if getChildren is supplied.
    getChildCount?: () => number;
    // A function which will be invoked when an overflow element is required.
    // This will be inserted after the children.
    createOverflowElement: (overflowCount: number, totalCount: number) => React.ReactNode;
    children?: ReactNode;
    id?: string;
}

export default class TruncatedList extends React.Component<IProps> {
    public static defaultProps = {
        truncateAt: 2,
        createOverflowElement(overflowCount: number, totalCount: number) {
            return <div>{_t("truncated_list_n_more", { count: overflowCount })}</div>;
        },
    };

    private getChildren(start: number, end: number): Array<React.ReactNode> {
        if (this.props.getChildren && this.props.getChildCount) {
            return this.props.getChildren(start, end);
        } else {
            // XXX: I'm not sure why anything would pass null into this, it seems
            // like a bizarre case to handle, but I'm preserving the behaviour.
            // (see commit 38d5c7d5c5d5a34dc16ef5d46278315f5c57f542)
            return React.Children.toArray(this.props.children)
                .filter((c) => {
                    return c != null;
                })
                .slice(start, end);
        }
    }

    private getChildCount(): number {
        if (this.props.getChildren && this.props.getChildCount) {
            return this.props.getChildCount();
        } else {
            return React.Children.toArray(this.props.children).filter((c) => {
                return c != null;
            }).length;
        }
    }

    public render(): ReactNode {
        let overflowNode: ReactNode | undefined;

        const totalChildren = this.getChildCount();
        let upperBound = totalChildren;
        if (this.props.truncateAt >= 0) {
            const overflowCount = totalChildren - this.props.truncateAt;
            if (overflowCount > 1) {
                overflowNode = this.props.createOverflowElement(overflowCount, totalChildren);
                upperBound = this.props.truncateAt;
            }
        }
        const childNodes = this.getChildren(0, upperBound);

        return (
            <div className={this.props.className} role="list" id={this.props.id}>
                {childNodes}
                {overflowNode}
            </div>
        );
    }
}
