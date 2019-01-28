/*
Copyright 2019 New Vector Ltd.

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

import React from "react";
import PropTypes from "prop-types";
import classnames from 'classnames';

import sdk from '../../../index';

class HexVerifyPair extends React.Component {
    static propTypes = {
        text: PropTypes.string.isRequired,
        index: PropTypes.number,
        verified: PropTypes.bool,
        onChange: PropTypes.func.isRequired,
    }

    _onClick = () => {
        this.setState({verified: !this.props.verified});
        this.props.onChange(this.props.index, !this.props.verified);
    }

    render() {
        const classNames = {
            mx_HexVerify_pair: true,
            mx_HexVerify_pair_verified: this.props.verified,
        };
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');
        return <AccessibleButton className={classnames(classNames)}
            onClick={this._onClick}
        >
            {this.props.text}
        </AccessibleButton>;
    }
}

/*
 * Helps a user verify a hexadecimal code matches one displayed
 * elsewhere (eg. on a different device)
 */
export default class HexVerify extends React.Component {
    static propTypes = {
        text: PropTypes.string.isRequired,
        onVerifiedStateChange: PropTypes.func,
    }

    static defaultProps = {
        onVerifiedStateChange: function() {},
    }

    constructor(props) {
        super(props);
        this.state = {
            pairsVerified: [],
        };
        for (let i = 0; i < props.text.length; i += 2) {
            this.state.pairsVerified.push(false);
        }
    }

    _onPairChange = (index, newVal) => {
        const oldVerified = this.state.pairsVerified.reduce((acc, val) => {
            return acc && val;
        }, true);
        const newPairsVerified = this.state.pairsVerified.slice(0);
        newPairsVerified[index] = newVal;
        const newVerified = newPairsVerified.reduce((acc, val) => {
            return acc && val;
        }, true);
        this.setState({pairsVerified: newPairsVerified});
        if (oldVerified !== newVerified) {
            this.props.onVerifiedStateChange(newVerified);
        }
    }

    render() {
        const pairs = [];

        for (let i = 0; i < this.props.text.length / 2; ++i) {
            pairs.push(<HexVerifyPair key={i} index={i}
                text={this.props.text.substr(i * 2, 2)}
                verified={this.state.pairsVerified[i]}
                onChange={this._onPairChange}
            />);
        }
        return <div className="mx_HexVerify">
            {pairs}
        </div>;
    }
}
