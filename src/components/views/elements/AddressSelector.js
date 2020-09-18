/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import classNames from 'classnames';
import { UserAddressType } from '../../../UserAddress';

export default class AddressSelector extends React.Component {
    static propTypes = {
        onSelected: PropTypes.func.isRequired,

        // List of the addresses to display
        addressList: PropTypes.arrayOf(UserAddressType).isRequired,
        // Whether to show the address on the address tiles
        showAddress: PropTypes.bool,
        truncateAt: PropTypes.number.isRequired,
        selected: PropTypes.number,

        // Element to put as a header on top of the list
        header: PropTypes.node,
    };

    constructor(props) {
        super(props);

        this.state = {
            selected: this.props.selected === undefined ? 0 : this.props.selected,
            hover: false,
        };
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(props) {
        // Make sure the selected item isn't outside the list bounds
        const selected = this.state.selected;
        const maxSelected = this._maxSelected(props.addressList);
        if (selected > maxSelected) {
            this.setState({ selected: maxSelected });
        }
    }

    componentDidUpdate() {
        // As the user scrolls with the arrow keys keep the selected item
        // at the top of the window.
        if (this.scrollElement && this.props.addressList.length > 0 && !this.state.hover) {
            const elementHeight = this.addressListElement.getBoundingClientRect().height;
            this.scrollElement.scrollTop = (this.state.selected * elementHeight) - elementHeight;
        }
    }

    moveSelectionTop = () => {
        if (this.state.selected > 0) {
            this.setState({
                selected: 0,
                hover: false,
            });
        }
    };

    moveSelectionUp = () => {
        if (this.state.selected > 0) {
            this.setState({
                selected: this.state.selected - 1,
                hover: false,
            });
        }
    };

    moveSelectionDown = () => {
        if (this.state.selected < this._maxSelected(this.props.addressList)) {
            this.setState({
                selected: this.state.selected + 1,
                hover: false,
            });
        }
    };

    chooseSelection = () => {
        this.selectAddress(this.state.selected);
    };

    onClick = index => {
        this.selectAddress(index);
    };

    onMouseEnter = index => {
        this.setState({
            selected: index,
            hover: true,
        });
    };

    onMouseLeave = () => {
        this.setState({ hover: false });
    };

    selectAddress = index => {
        // Only try to select an address if one exists
        if (this.props.addressList.length !== 0) {
            this.props.onSelected(index);
            this.setState({ hover: false });
        }
    };

    createAddressListTiles() {
        const AddressTile = sdk.getComponent("elements.AddressTile");
        const maxSelected = this._maxSelected(this.props.addressList);
        const addressList = [];

        // Only create the address elements if there are address
        if (this.props.addressList.length > 0) {
            for (let i = 0; i <= maxSelected; i++) {
                const classes = classNames({
                    "mx_AddressSelector_addressListElement": true,
                    "mx_AddressSelector_selected": this.state.selected === i,
                });

                // NOTE: Defaulting to "vector" as the network, until the network backend stuff is done.
                // Saving the addressListElement so we can use it to work out, in the componentDidUpdate
                // method, how far to scroll when using the arrow keys
                addressList.push(
                    <div
                        className={classes}
                        onClick={this.onClick.bind(this, i)}
                        onMouseEnter={this.onMouseEnter.bind(this, i)}
                        onMouseLeave={this.onMouseLeave}
                        key={this.props.addressList[i].addressType + "/" + this.props.addressList[i].address}
                        ref={(ref) => { this.addressListElement = ref; }}
                    >
                        <AddressTile
                            address={this.props.addressList[i]}
                            showAddress={this.props.showAddress}
                            justified={true}
                            networkName="vector"
                            networkUrl={require("../../../../res/img/search-icon-vector.svg")}
                        />
                    </div>,
                );
            }
        }
        return addressList;
    }

    _maxSelected(list) {
        const listSize = list.length === 0 ? 0 : list.length - 1;
        const maxSelected = listSize > (this.props.truncateAt - 1) ? (this.props.truncateAt - 1) : listSize;
        return maxSelected;
    }

    render() {
        const classes = classNames({
            "mx_AddressSelector": true,
            "mx_AddressSelector_empty": this.props.addressList.length === 0,
        });

        return (
            <div className={classes} ref={(ref) => {this.scrollElement = ref;}}>
                { this.props.header }
                { this.createAddressListTiles() }
            </div>
        );
    }
}
