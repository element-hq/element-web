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

const React = require('react');
const ReactDOM = require('react-dom');
const PropTypes = require('prop-types');

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

function getOrCreateContainer(containerId) {
    let container = document.getElementById(containerId);

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
    }

    collectChildContainer(ref) {
        this.childContainer = ref;
    }

    collectChild(ref) {
        this.child = ref;
        this.updateChild();
    }

    componentDidMount() {
        this.updateChild();
    }

    componentDidUpdate() {
        this.updateChild();
    }

    componentWillUnmount() {
        this.updateChildVisibility(this.child, false);
    }

    updateChild() {
        this.updateChildPosition(this.child, this.childContainer);
        this.updateChildVisibility(this.child, true);
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
        const content = <div ref={this.collectChild} style={this.props.style}>
            {this.props.children}
        </div>;

        ReactDOM.render(content, getOrCreateContainer('mx_persistedElement_'+this.props.persistKey));

        return <div ref={this.collectChildContainer}></div>;
    }
}
