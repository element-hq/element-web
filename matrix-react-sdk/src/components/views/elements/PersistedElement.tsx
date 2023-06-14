/*
Copyright 2018 New Vector Ltd.

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

import React, { MutableRefObject, ReactNode } from "react";
import ReactDOM from "react-dom";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";

import dis from "../../../dispatcher/dispatcher";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { ActionPayload } from "../../../dispatcher/payloads";

export const getPersistKey = (appId: string): string => "widget_" + appId;

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

function getContainer(containerId: string): HTMLDivElement {
    return document.getElementById(containerId) as HTMLDivElement;
}

function getOrCreateContainer(containerId: string): HTMLDivElement {
    let container = getContainer(containerId);

    if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        document.body.appendChild(container);
    }

    return container;
}

interface IProps {
    // Unique identifier for this PersistedElement instance
    // Any PersistedElements with the same persistKey will use
    // the same DOM container.
    persistKey: string;

    // z-index for the element. Defaults to 9.
    zIndex?: number;

    style?: React.StyleHTMLAttributes<HTMLDivElement>;

    // Handle to manually notify this PersistedElement that it needs to move
    moveRef?: MutableRefObject<(() => void) | undefined>;
    children: ReactNode;
}

/**
 * Class of component that renders its children in a separate ReactDOM virtual tree
 * in a container element appended to document.body.
 *
 * This prevents the children from being unmounted when the parent of PersistedElement
 * unmounts, allowing them to persist.
 *
 * When PE is unmounted, it hides the children using CSS. When mounted or updated, the
 * children are made visible and are positioned into a div that is given the same
 * bounding rect as the parent of PE.
 */
export default class PersistedElement extends React.Component<IProps> {
    private resizeObserver: ResizeObserver;
    private dispatcherRef: string;
    private childContainer?: HTMLDivElement;
    private child?: HTMLDivElement;

    public constructor(props: IProps) {
        super(props);

        this.resizeObserver = new ResizeObserver(this.repositionChild);
        // Annoyingly, a resize observer is insufficient, since we also care
        // about when the element moves on the screen without changing its
        // dimensions. Doesn't look like there's a ResizeObserver equivalent
        // for this, so we bodge it by listening for document resize and
        // the timeline_resize action.
        window.addEventListener("resize", this.repositionChild);
        this.dispatcherRef = dis.register(this.onAction);

        if (this.props.moveRef) this.props.moveRef.current = this.repositionChild;
    }

    /**
     * Removes the DOM elements created when a PersistedElement with the given
     * persistKey was mounted. The DOM elements will be re-added if another
     * PersistedElement is mounted in the future.
     *
     * @param {string} persistKey Key used to uniquely identify this PersistedElement
     */
    public static destroyElement(persistKey: string): void {
        const container = getContainer("mx_persistedElement_" + persistKey);
        if (container) {
            container.remove();
        }
    }

    public static isMounted(persistKey: string): boolean {
        return Boolean(getContainer("mx_persistedElement_" + persistKey));
    }

    private collectChildContainer = (ref: HTMLDivElement): void => {
        if (this.childContainer) {
            this.resizeObserver.unobserve(this.childContainer);
        }
        this.childContainer = ref;
        if (ref) {
            this.resizeObserver.observe(ref);
        }
    };

    private collectChild = (ref: HTMLDivElement): void => {
        this.child = ref;
        this.updateChild();
    };

    public componentDidMount(): void {
        this.updateChild();
        this.renderApp();
    }

    public componentDidUpdate(): void {
        this.updateChild();
        this.renderApp();
    }

    public componentWillUnmount(): void {
        this.updateChildVisibility(this.child, false);
        this.resizeObserver.disconnect();
        window.removeEventListener("resize", this.repositionChild);
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "timeline_resize") {
            this.repositionChild();
        } else if (payload.action === "logout") {
            PersistedElement.destroyElement(this.props.persistKey);
        }
    };

    private repositionChild = (): void => {
        this.updateChildPosition(this.child, this.childContainer);
    };

    private updateChild(): void {
        this.updateChildPosition(this.child, this.childContainer);
        this.updateChildVisibility(this.child, true);
    }

    private renderApp(): void {
        const content = (
            <MatrixClientContext.Provider value={MatrixClientPeg.get()}>
                <div ref={this.collectChild} style={this.props.style}>
                    {this.props.children}
                </div>
            </MatrixClientContext.Provider>
        );

        ReactDOM.render(content, getOrCreateContainer("mx_persistedElement_" + this.props.persistKey));
    }

    private updateChildVisibility(child?: HTMLDivElement, visible = false): void {
        if (!child) return;
        child.style.display = visible ? "block" : "none";
    }

    private updateChildPosition(child?: HTMLDivElement, parent?: HTMLDivElement): void {
        if (!child || !parent) return;

        const parentRect = parent.getBoundingClientRect();
        Object.assign(child.style, {
            zIndex: isNullOrUndefined(this.props.zIndex) ? 9 : this.props.zIndex,
            position: "absolute",
            top: "0",
            left: "0",
            transform: `translateX(${parentRect.left}px) translateY(${parentRect.top}px)`,
            width: parentRect.width + "px",
            height: parentRect.height + "px",
        });
    }

    public render(): React.ReactNode {
        return <div ref={this.collectChildContainer} />;
    }
}
