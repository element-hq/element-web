/*
Copyright 2016 OpenMarket Ltd

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

export default class NetworkDropdown extends React.Component {
    constructor() {
        super();

        this.dropdownRootElement = null;
        this.ignoreEvent = null;

        this.onClick = this.onClick.bind(this);
        this.onRootClick = this.onRootClick.bind(this);
        this.onDocumentClick = this.onDocumentClick.bind(this);
        this.onNetworkClick = this.onNetworkClick.bind(this);
        this.collectRoot = this.collectRoot.bind(this);

        this.state = {
            expanded: false,
            selectedNetwork: 'all',
        };

        this.networks = [
            'matrix_org',
            'freenode',
            'gitter',
        ];

        this.networkNames = {
            'matrix_org': 'matrix.org',
            'freenode': 'Freenode',
            'gitter': 'Gitter',
        };

        this.networkIcons = {
            'matrix_org': '//matrix.org/favicon.ico',
            'freenode': '//matrix.org/_matrix/media/v1/download/matrix.org/DHLHpDDgWNNejFmrewvwEAHX',
            'gitter': '//gitter.im/favicon.ico',
        };
    }

    componentWillMount() {
        // Listen for all clicks on the document so we can close the
        // menu when the user clicks somewhere else
        document.addEventListener('click', this.onDocumentClick, false);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.onDocumentClick, false);
    }

    onDocumentClick(ev) {
        // Close the dropdown if the user clicks anywhere that isn't
        // within our root element
        if (ev !== this.ignoreEvent) {
            this.setState({
                expanded: false,
            });
        }
    }

    onRootClick(ev) {
        // This captures any clicks that happen within our elements,
        // such that we can then ignore them when they're seen by the
        // click listener on the document handler, ie. not close the
        // dropdown immediately after opening it.
        // NB. We can't just stopPropagation() because then the event
        // doesn't reach the React onClick().
        this.ignoreEvent = ev;
    }

    onClick(ev) {
        this.setState({
            expanded: !this.state.expanded,
        });
    }

    onNetworkClick(network, ev) {
        this.setState({
            expanded: false,
            selectedNetwork: network,
        });
    }

    collectRoot(e) {
        if (this.dropdownRootElement) {
            this.dropdownRootElement.removeEventListener('click', this.onRootClick, false);
        }
        if (e) {
            e.addEventListener('click', this.onRootClick, false);
        }
        this.dropdownRootElement = e;
    }

    _optionForNetwork(network) {
        let icon;
        let name;
        let spanClass;

        if (network == 'all') {
            name = 'All networks';
            spanClass = 'mx_NetworkDropdown_menu_all';
        } else {
            name = this.networkNames[network];
            icon = <img src={this.networkIcons[network]} />;
            spanClass = 'mx_NetworkDropdown_menu_network';
        }

        return <div key={network} className="mx_NetworkDropdown_networkoption" onClick={this.onNetworkClick.bind(this, network)}>
            {icon}
            <span className={spanClass}>{name}</span>
        </div>;
    }

    render() {
        const currentValue = this._optionForNetwork(this.state.selectedNetwork);

        let menu;
        if (this.state.expanded) {
           const menuOptions = [this._optionForNetwork('all')];
            for (const network of this.networks) {
                menuOptions.push(this._optionForNetwork(network));
            }
            menu = <div className="mx_NetworkDropdown_menu">
                {menuOptions}
            </div>;
        }

        return <div className="mx_NetworkDropdown" ref={this.collectRoot}>
            <div className="mx_NetworkDropdown_input" onClick={this.onClick}>
                {currentValue}
                <span className="mx_NetworkDropdown_arrow"></span>
                {menu}
            </div>
        </div>;
    }
}

