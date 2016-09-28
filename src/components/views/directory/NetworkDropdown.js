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
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';

export default class NetworkDropdown extends React.Component {
    constructor(props) {
        super(props);

        this.dropdownRootElement = null;
        this.ignoreEvent = null;

        this.onInputClick = this.onInputClick.bind(this);
        this.onRootClick = this.onRootClick.bind(this);
        this.onDocumentClick = this.onDocumentClick.bind(this);
        this.onMenuOptionClick = this.onMenuOptionClick.bind(this);
        this.onInputKeyUp = this.onInputKeyUp.bind(this);
        this.collectRoot = this.collectRoot.bind(this);
        this.collectInputTextBox = this.collectInputTextBox.bind(this);

        this.inputTextBox = null;

        let defaultNetwork = null;
        if (
            this.props.config.serverConfig &&
            this.props.config.serverConfig[server] &&
            this.props.config.serverConfig[server].networks &&
            '_matrix' in this.props.config.serverConfig[server].networks
        ) {
            defaultNetwork = '_matrix';
        }

        this.state = {
            expanded: false,
            selectedServer: MatrixClientPeg.getHomeServerName(),
            selectedNetwork: defaultNetwork,
        };
    }

    componentWillMount() {
        // Listen for all clicks on the document so we can close the
        // menu when the user clicks somewhere else
        document.addEventListener('click', this.onDocumentClick, false);

        // fire this now so the defaults can be set up
        this.props.onOptionChange(this.state.selectedServer, this.state.selectedNetwork);
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

    onInputClick(ev) {
        this.setState({
            expanded: !this.state.expanded,
        });
        ev.preventDefault();
    }

    onMenuOptionClick(server, network, ev) {
        this.setState({
            expanded: false,
            selectedServer: server,
            selectedNetwork: network,
        });
        this.props.onOptionChange(server, network);
    }

    onInputKeyUp(e) {
        if (e.key == 'Enter') {
            this.setState({
                expanded: false,
                selectedServer: e.target.value,
                selectedNetwork: null,
            });
            this.props.onOptionChange(e.target.value, null);
        }
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

    collectInputTextBox(e) {
        this.inputTextBox = e;
    }

    _getMenuOptions() {
        const options = [];

        let servers = [];
        if (this.props.config.servers) {
            servers = servers.concat(this.props.config.servers);
        }

        if (servers.indexOf(MatrixClientPeg.getHomeServerName()) == -1) {
            servers.unshift(MatrixClientPeg.getHomeServerName());
        }

        for (const server of servers) {
            options.push(this._makeMenuOption(server, null));
            if (this.props.config.serverConfig && this.props.config.serverConfig[server] && this.props.config.serverConfig[server].networks) {
                for (const network of this.props.config.serverConfig[server].networks) {
                    options.push(this._makeMenuOption(server, network));
                }
            }
        }

        return options;
    }

    _makeMenuOption(server, network, wire_onclick) {
        if (wire_onclick === undefined) wire_onclick = true;
        let icon;
        let name;
        let span_class;

        if (network === null) {
            name = server;
            span_class = 'mx_NetworkDropdown_menu_all';
        } else if (network == '_matrix') {
            name = 'Matrix';
            icon = <img src="/img/network-matrix.svg" width="16" height="16" />;
            span_class = 'mx_NetworkDropdown_menu_network';
        } else {
            name = this.props.config.networkNames[network];
            icon = <img src={this.props.config.networkIcons[network]} />;
            span_class = 'mx_NetworkDropdown_menu_network';
        }

        const click_handler = wire_onclick ? this.onMenuOptionClick.bind(this, server, network) : null;

        let key = server;
        if (network !== null) {
            key += '_' + network;
        }

        return <div key={key} className="mx_NetworkDropdown_networkoption" onClick={click_handler}>
            {icon}
            <span className={span_class}>{name}</span>
        </div>;
    }

    componentDidUpdate() {
        if (this.state.expanded && this.inputTextBox) {
            this.inputTextBox.focus();
        }
    }

    render() {
        let current_value = this._makeMenuOption(
            this.state.selectedServer, this.state.selectedNetwork, false
        );

        let menu;
        if (this.state.expanded) {
            const menu_options = this._getMenuOptions();
            menu = <div className="mx_NetworkDropdown_menu">
                {menu_options}
            </div>;
            current_value = <input type="text" className="mx_NetworkDropdown_networkoption"
                ref={this.collectInputTextBox} onKeyUp={this.onInputKeyUp}
            />
        }

        return <div className="mx_NetworkDropdown" ref={this.collectRoot}>
            <div className="mx_NetworkDropdown_input" onClick={this.onInputClick}>
                {current_value}
                <span className="mx_NetworkDropdown_arrow"></span>
                {menu}
            </div>
        </div>;
    }
}

NetworkDropdown.propTypes = {
    onOptionChange: React.PropTypes.func.isRequired,
    config: React.PropTypes.object,
};

NetworkDropdown.defaultProps = {
    config: {
        networks: [],
    }
};

