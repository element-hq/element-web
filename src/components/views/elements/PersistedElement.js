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

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import ResizeObserver from 'resize-observer-polyfill';

import dis from '../../../dispatcher/dispatcher';

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

function getContainer(containerId) {
    return document.getElementById(containerId);
}

function getOrCreateContainer(containerId) {
    let container = getContainer(containerId);

    if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        document.body.appendChild(container);
    }

    return container;
}

/*
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
export default class PersistedElement extends React.Component {
    static propTypes = {
        // Unique identifier for this PersistedElement instance
        // Any PersistedElements with the same persistKey will use
        // the same DOM container.
        persistKey: PropTypes.string.isRequired,
    };

    constructor() {
        super();
        this.collectChildContainer = this.collectChildContainer.bind(this);
        this.collectChild = this.collectChild.bind(this);
        this._repositionChild = this._repositionChild.bind(this);
        this._onAction = this._onAction.bind(this);

        this.resizeObserver = new ResizeObserver(this._repositionChild);
        // Annoyingly, a resize observer is insufficient, since we also care
        // about when the element moves on the screen without changing its
        // dimensions. Doesn't look like there's a ResizeObserver equivalent
        // for this, so we bodge it by listening for document resize and
        // the timeline_resize action.
        window.addEventListener('resize', this._repositionChild);
        this._dispatcherRef = dis.register(this._onAction);
    }

    /**
     * Removes the DOM elements created when a PersistedElement with the given
     * persistKey was mounted. The DOM elements will be re-added if another
     * PeristedElement is mounted in the future.
     *
     * @param {string} persistKey Key used to uniquely identify this PersistedElement
     */
    static destroyElement(persistKey) {
        const container = getContainer('mx_persistedElement_' + persistKey);
        if (container) {
            container.remove();
        }
    }

    static isMounted(persistKey) {
        return Boolean(getContainer('mx_persistedElement_' + persistKey));
    }

    collectChildContainer(ref) {
        if (this.childContainer) {
            this.resizeObserver.unobserve(this.childContainer);
        }
        this.childContainer = ref;
        if (ref) {
            this.resizeObserver.observe(ref);
        }
    }

    collectChild(ref) {
        this.child = ref;
        this.updateChild();
    }

    componentDidMount() {
        this.updateChild();
        this.renderApp();
    }

    componentDidUpdate() {
        this.updateChild();
        this.renderApp();
    }

    componentWillUnmount() {
        this.updateChildVisibility(this.child, false);
        this.resizeObserver.disconnect();
        window.removeEventListener('resize', this._repositionChild);
        dis.unregister(this._dispatcherRef);
    }

    _onAction(payload) {
        if (payload.action === 'timeline_resize') {
            this._repositionChild();
        }
    }

    _repositionChild() {
        this.updateChildPosition(this.child, this.childContainer);
    }

    updateChild() {
        this.updateChildPosition(this.child, this.childContainer);
        this.updateChildVisibility(this.child, true);
    }

    renderApp() {
        const content = <div ref={this.collectChild} style={this.props.style}>
            {this.props.children}
        </div>;

        ReactDOM.render(content, getOrCreateContainer('mx_persistedElement_'+this.props.persistKey));
    }

    updateChildVisibility(child, visible) {
        if (!child) return;
        child.style.display = visible ? 'block' : 'none';
    }

    updateChildPosition(child, parent) {
        if (!child || !parent) return;

        const parentRect = parent.getBoundingClientRect();
        Object.assign(child.style, {
            position: 'absolute',
            top: parentRect.top + 'px',
            left: parentRect.left + 'px',
            width: parentRect.width + 'px',
            height: parentRect.height + 'px',
        });
    }

    render() {
        return <div ref={this.collectChildContainer}></div>;
    }
}
