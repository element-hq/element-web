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
import {instanceForInstanceId} from '../../../utils/DirectoryUtils';

const DEFAULT_ICON_URL = "img/network-matrix.svg";

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

        const server = MatrixClientPeg.getHomeServerName();
        this.state = {
            expanded: false,
            selectedServer: server,
            selectedInstance: null,
            includeAllNetworks: false,
        };
    }

    componentWillMount() {
        // Listen for all clicks on the document so we can close the
        // menu when the user clicks somewhere else
        document.addEventListener('click', this.onDocumentClick, false);

        // fire this now so the defaults can be set up
        this.props.onOptionChange(this.state.selectedServer, this.state.selectedInstance, this.state.includeAllNetworks);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.onDocumentClick, false);
    }

    componentDidUpdate() {
        if (this.state.expanded && this.inputTextBox) {
            this.inputTextBox.focus();
        }
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

    onMenuOptionClick(server, instance, includeAll) {
        this.setState({
            expanded: false,
            selectedServer: server,
            selectedInstanceId: instance ? instance.instance_id : null,
            includeAll: includeAll,
        });
        this.props.onOptionChange(server, instance ? instance.instance_id : null, includeAll);
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

        // For our own HS, we can use the instance_ids given in the third party protocols
        // response to get the server to filter the room list by network for us.
        // We can't get thirdparty protocols for remote server yet though, so for those
        // we can only show the default room list.
        for (const server of servers) {
            options.push(this._makeMenuOption(server, null, true));
            if (server == MatrixClientPeg.getHomeServerName()) {
                options.push(this._makeMenuOption(server, null, false));
                if (this.props.protocols) {
                    for (const proto of Object.keys(this.props.protocols)) {
                        if (!this.props.protocols[proto].instances) continue;
                        for (const instance of this.props.protocols[proto].instances) {
                            if (!instance.instance_id) continue;
                            options.push(this._makeMenuOption(server, instance, false));
                        }
                    }
                }
            }
        }

        return options;
    }

    _makeMenuOption(server, instance, includeAll, handleClicks) {
        if (handleClicks === undefined) handleClicks = true;

        let icon;
        let name;
        let span_class;
        let key;

        if (!instance && includeAll) {
            key = server;
            name = server;
            span_class = 'mx_NetworkDropdown_menu_all';
        } else if (!instance) {
            key = server + '_all';
            name = 'Matrix';
            icon = <img src="img/network-matrix.svg" />;
            span_class = 'mx_NetworkDropdown_menu_network';
        } else {
            key = server + '_inst_'+instance.instance_id;
            icon = <img src={instance.icon || DEFAULT_ICON_URL} />;
            name = instance.desc;
            span_class = 'mx_NetworkDropdown_menu_network';
        }

        const click_handler = handleClicks ? this.onMenuOptionClick.bind(this, server, instance, includeAll) : null;

        return <div key={key} className="mx_NetworkDropdown_networkoption" onClick={click_handler}>
            {icon}
            <span className="mx_NetworkDropdown_menu_network">{name}</span>
        </div>
    }

    render() {
        let current_value;

        let menu;
        if (this.state.expanded) {
            const menu_options = this._getMenuOptions();
            menu = <div className="mx_NetworkDropdown_menu">
                {menu_options}
            </div>;
            current_value = <input type="text" className="mx_NetworkDropdown_networkoption"
                ref={this.collectInputTextBox} onKeyUp={this.onInputKeyUp}
                placeholder="matrix.org" // 'matrix.org' as an example of an HS name
            />
        } else {
            const instance = instanceForInstanceId(this.props.protocols, this.state.selectedInstanceId);
            current_value = this._makeMenuOption(
                this.state.selectedServer, instance, this.state.includeAll, false
            );
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
    protocols: React.PropTypes.object,
    config: React.PropTypes.object,
};

NetworkDropdown.defaultProps = {
    protocols: {},
    config: {},
};
