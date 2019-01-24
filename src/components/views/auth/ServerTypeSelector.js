/*
Copyright 2019 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import classnames from 'classnames';

const MODULAR_URL = 'https://modular.im/?utm_source=riot-web&utm_medium=web&utm_campaign=riot-web-authentication';

const TYPES = [
    {
        id: 'Free',
        label: () => _t('Free'),
        logo: () => <img src={require('../../../../res/img/feather-icons/matrix-org-bw-logo.svg')} />,
        description: () => _t('Join millions for free on the largest public server'),
    },
    {
        id: 'Premium',
        label: () => _t('Premium'),
        logo: () => <img src={require('../../../../res/img/feather-icons/modular-bw-logo.svg')} />,
        description: () => _t('Premium hosting for organisations <a>Learn more</a>', {}, {
            a: sub => <a href={MODULAR_URL} target="_blank" rel="noopener">
                {sub}
            </a>,
        }),
    },
    {
        id: 'Advanced',
        label: () => _t('Advanced'),
        logo: () => <div>
            <img src={require('../../../../res/img/feather-icons/globe.svg')} />
            {_t('Other')}
        </div>,
        description: () => _t('Find other public servers or use a custom server'),
    },
];

export default class ServerTypeSelector extends React.PureComponent {
    static propTypes = {
        // ID of the initial type to show as selected or null for none.
        selected: PropTypes.string,
        // Handler called when the selected type changes.
        onChange: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            selected: null,
        };
    }

    componentWillReceiveProps(props) {
        const { selected } = props;
        this.setState({
            selected,
        });
    }

    onClick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (this.state.selected === id) {
            return;
        }
        this.setState({
            selected: id,
        });
        if (this.props.onChange) {
            this.props.onChange(id);
        }
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const serverTypes = TYPES.map(type => {
            const { id, label, logo, description } = type;
            const classes = classnames(
                "mx_ServerTypeSelector_type",
                `mx_ServerTypeSelector_type_${id}`,
                {
                    "mx_ServerTypeSelector_type_selected": id === this.state.selected,
                },
            );

            return <div className={classes} key={id} >
                <div className="mx_ServerTypeSelector_label">
                    {label()}
                </div>
                <AccessibleButton onClick={this.onClick} data-id={id}>
                    <div className="mx_ServerTypeSelector_logo">
                        {logo()}
                    </div>
                    <div className="mx_ServerTypeSelector_description">
                        {description()}
                    </div>
                </AccessibleButton>
            </div>;
        });

        return <div className="mx_ServerTypeSelector">
            {serverTypes}
        </div>;
    }
}
