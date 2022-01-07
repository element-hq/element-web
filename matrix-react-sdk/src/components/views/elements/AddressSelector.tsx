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

import React, { createRef } from 'react';
import classNames from 'classnames';

import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IUserAddress } from '../../../UserAddress';
import AddressTile from './AddressTile';

interface IProps {
    onSelected: (index: number) => void;

    // List of the addresses to display
    addressList: IUserAddress[];
    // Whether to show the address on the address tiles
    showAddress?: boolean;
    truncateAt: number;
    selected?: number;

    // Element to put as a header on top of the list
    header?: JSX.Element;
}

interface IState {
    selected: number;
    hover: boolean;
}

@replaceableComponent("views.elements.AddressSelector")
export default class AddressSelector extends React.Component<IProps, IState> {
    private scrollElement = createRef<HTMLDivElement>();
    private addressListElement = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            selected: this.props.selected === undefined ? 0 : this.props.selected,
            hover: false,
        };
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(props: IProps) { // eslint-disable-line
        // Make sure the selected item isn't outside the list bounds
        const selected = this.state.selected;
        const maxSelected = this.maxSelected(props.addressList);
        if (selected > maxSelected) {
            this.setState({ selected: maxSelected });
        }
    }

    componentDidUpdate() {
        // As the user scrolls with the arrow keys keep the selected item
        // at the top of the window.
        if (this.scrollElement.current && this.props.addressList.length > 0 && !this.state.hover) {
            const elementHeight = this.addressListElement.current.getBoundingClientRect().height;
            this.scrollElement.current.scrollTop = (this.state.selected * elementHeight) - elementHeight;
        }
    }

    public moveSelectionTop = (): void => {
        if (this.state.selected > 0) {
            this.setState({
                selected: 0,
                hover: false,
            });
        }
    };

    public moveSelectionUp = (): void => {
        if (this.state.selected > 0) {
            this.setState({
                selected: this.state.selected - 1,
                hover: false,
            });
        }
    };

    public moveSelectionDown = (): void => {
        if (this.state.selected < this.maxSelected(this.props.addressList)) {
            this.setState({
                selected: this.state.selected + 1,
                hover: false,
            });
        }
    };

    public chooseSelection = (): void => {
        this.selectAddress(this.state.selected);
    };

    private onClick = (index: number): void => {
        this.selectAddress(index);
    };

    private onMouseEnter = (index: number): void => {
        this.setState({
            selected: index,
            hover: true,
        });
    };

    private onMouseLeave = (): void => {
        this.setState({ hover: false });
    };

    private selectAddress = (index: number): void => {
        // Only try to select an address if one exists
        if (this.props.addressList.length !== 0) {
            this.props.onSelected(index);
            this.setState({ hover: false });
        }
    };

    private createAddressListTiles(): JSX.Element[] {
        const maxSelected = this.maxSelected(this.props.addressList);
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
                        ref={this.addressListElement}
                    >
                        <AddressTile
                            address={this.props.addressList[i]}
                            showAddress={this.props.showAddress}
                            justified={true}
                        />
                    </div>,
                );
            }
        }
        return addressList;
    }

    private maxSelected(list: IUserAddress[]): number {
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
            <div className={classes} ref={this.scrollElement}>
                { this.props.header }
                { this.createAddressListTiles() }
            </div>
        );
    }
}
