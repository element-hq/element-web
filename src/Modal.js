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

const DIALOG_CONTAINER_ID = "mx_Dialog_Container";

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
        // XXX: temporary logging to try to diagnose
        // https://github.com/vector-im/riot-web/issues/3148
        console.log('Starting load of AsyncWrapper for modal');
        this.props.loader((e) => {
            // XXX: temporary logging to try to diagnose
            // https://github.com/vector-im/riot-web/issues/3148
            console.log('AsyncWrapper load completed with '+e.displayName);
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

class ModalManager {
    constructor() {
        this._counter = 0;

        /** list of the modals we have stacked up, with the most recent at [0] */
        this._modals = [
            /* {
               elem: React component for this dialog
               onFinished: caller-supplied onFinished callback
               className: CSS class for the dialog wrapper div
               } */
        ];

        this.closeAll = this.closeAll.bind(this);
    }

    getOrCreateContainer() {
        let container = document.getElementById(DIALOG_CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = DIALOG_CONTAINER_ID;
            document.body.appendChild(container);
        }

        return container;
    }

    createDialog(Element, props, className) {
        return this.createDialogAsync((cb) => {cb(Element);}, props, className);
    }

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
    createDialogAsync(loader, props, className) {
        var self = this;
        const modal = {};

        // never call this from onFinished() otherwise it will loop
        //
        // nb explicit function() rather than arrow function, to get `arguments`
        var closeDialog = function() {
            if (props && props.onFinished) props.onFinished.apply(null, arguments);
            var i = self._modals.indexOf(modal);
            if (i >= 0) {
                self._modals.splice(i, 1);
            }
            self._reRender();
        };

        // don't attempt to reuse the same AsyncWrapper for different dialogs,
        // otherwise we'll get confused.
        const modalCount = this._counter++;

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        modal.elem = (
            <AsyncWrapper key={modalCount} loader={loader} {...props}
                onFinished={closeDialog}/>
        );
        modal.onFinished = props ? props.onFinished : null;
        modal.className = className;

        this._modals.unshift(modal);

        this._reRender();
        return {close: closeDialog};
    }

    closeAll() {
        const modals = this._modals;
        this._modals = [];

        for (let i = 0; i < modals.length; i++) {
            const m = modals[i];
            if (m.onFinished) {
                m.onFinished(false);
            }
        }

        this._reRender();
    }

    _reRender() {
        if (this._modals.length == 0) {
            ReactDOM.unmountComponentAtNode(this.getOrCreateContainer());
            return;
        }

        var modal = this._modals[0];
        var dialog = (
            <div className={"mx_Dialog_wrapper " + (modal.className ? modal.className : '') }>
                <div className="mx_Dialog">
                    {modal.elem}
                </div>
                <div className="mx_Dialog_background" onClick={ this.closeAll }></div>
            </div>
        );

        ReactDOM.render(dialog, this.getOrCreateContainer());
    }
}

export default new ModalManager();
