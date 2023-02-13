/*
Copyright 2017 New Vector Ltd

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
    public constructor(props: IProps) {
        super(props);
    }

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
