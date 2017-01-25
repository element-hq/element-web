/*
Copyright 2015, 2016 OpenMarket Ltd

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


'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
import sdk from './index';

/**
 * Wrap an asynchronous loader function with a react component which shows a
 * spinner until the real component loads.
 */
const AsyncWrapper = React.createClass({
    propTypes: {
        /** A function which takes a 'callback' argument which it will call
         * with the real component once it loads.
         */
        loader: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            component: null,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this.props.loader((e) => {
            if (this._unmounted) {
                return;
            }
            this.setState({component: e});
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    render: function() {
        const {loader, ...otherProps} = this.props;

        if (this.state.component) {
            const Component = this.state.component;
            return <Component {...otherProps} />;
        } else {
            // show a spinner until the component is loaded.
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }
    },
});

let _counter = 0;

module.exports = {
    DialogContainerId: "mx_Dialog_Container",

    getOrCreateContainer: function() {
        var container = document.getElementById(this.DialogContainerId);

        if (!container) {
            container = document.createElement("div");
            container.id = this.DialogContainerId;
            document.body.appendChild(container);
        }

        return container;
    },

    createDialog: function(Element, props, className) {
        return this.createDialogAsync((cb) => {cb(Element);}, props, className);
    },

    /**
     * Open a modal view.
     *
     * This can be used to display a react component which is loaded as an asynchronous
     * webpack component. To do this, set 'loader' as:
     *
     *   (cb) => {
     *       require(['<module>'], cb);
     *   }
     *
     * @param {Function} loader   a function which takes a 'callback' argument,
     *   which it should call with a React component which will be displayed as
     *   the modal view.
     *
     * @param {Object} props   properties to pass to the displayed
     *    component. (We will also pass an 'onFinished' property.)
     *
     * @param {String} className   CSS class to apply to the modal wrapper
     */
    createDialogAsync: function(loader, props, className) {
        var self = this;
        // never call this via modal.close() from onFinished() otherwise it will loop
        var closeDialog = function() {
            if (props && props.onFinished) props.onFinished.apply(null, arguments);
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());
        };

        // don't attempt to reuse the same AsyncWrapper for different dialogs,
        // otherwise we'll get confused.
        const modalCount = _counter++;

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        var dialog = (
            <div className={"mx_Dialog_wrapper " + className}>
                <div className="mx_Dialog">
                    <AsyncWrapper key={modalCount} loader={loader} {...props} onFinished={closeDialog}/>
                </div>
                <div className="mx_Dialog_background" onClick={ closeDialog.bind(this, false) }></div>
            </div>
        );

        ReactDOM.render(dialog, this.getOrCreateContainer());

        return {close: closeDialog};
    },
};
