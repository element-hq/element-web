/*
Copyright 2017-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

interface IProps {
    element: React.ReactNode;
    // Function to be called when the parent window is resized
    // This can be used to reposition or close the menu on resize and
    // ensure that it is not displayed in a stale position.
    onResize?: () => void;
}

/**
 * This component can be used to display generic HTML content in a contextual
 * menu.
 */
export default class GenericElementContextMenu extends React.Component<IProps> {
    public componentDidMount(): void {
        window.addEventListener("resize", this.resize);
    }

    public componentWillUnmount(): void {
        window.removeEventListener("resize", this.resize);
    }

    private resize = (): void => {
        if (this.props.onResize) {
            this.props.onResize();
        }
    };

    public render(): React.ReactNode {
        return <div>{this.props.element}</div>;
    }
}
