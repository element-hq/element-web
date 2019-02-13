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

export const FREE = 'Free';
export const PREMIUM = 'Premium';
export const ADVANCED = 'Advanced';

export const TYPES = {
    FREE: {
        id: FREE,
        label: () => _t('Free'),
        logo: () => <img src={require('../../../../res/img/feather-icons/matrix-org-bw-logo.svg')} />,
        description: () => _t('Join millions for free on the largest public server'),
        hsUrl: 'https://matrix.org',
        isUrl: 'https://vector.im',
    },
    PREMIUM: {
        id: PREMIUM,
        label: () => _t('Premium'),
        logo: () => <img src={require('../../../../res/img/feather-icons/modular-bw-logo.svg')} />,
        description: () => _t('Premium hosting for organisations <a>Learn more</a>', {}, {
            a: sub => <a href={MODULAR_URL} target="_blank" rel="noopener">
                {sub}
            </a>,
        }),
    },
    ADVANCED: {
        id: ADVANCED,
        label: () => _t('Advanced'),
        logo: () => <div>
            <img src={require('../../../../res/img/feather-icons/globe.svg')} />
            {_t('Other')}
        </div>,
        description: () => _t('Find other public servers or use a custom server'),
    },
};

function getDefaultType(defaultHsUrl) {
    if (!defaultHsUrl) {
        return null;
    } else if (defaultHsUrl === TYPES.FREE.hsUrl) {
        return FREE;
    } else if (new URL(defaultHsUrl).hostname.endsWith('.modular.im')) {
        // TODO: Use a Riot config parameter to detect Modular-ness.
        // https://github.com/vector-im/riot-web/issues/8253
        return PREMIUM;
    } else {
        return ADVANCED;
    }
}

export default class ServerTypeSelector extends React.PureComponent {
    static propTypes = {
        // The default HS URL as another way to set the initially selected type.
        defaultHsUrl: PropTypes.string,
        // Handler called when the selected type changes.
        onChange: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        const {
            defaultHsUrl,
            onChange,
        } = props;
        const type = getDefaultType(defaultHsUrl);
        this.state = {
            selected: type,
        };
        if (onChange) {
            // FIXME: Supply a second 'initial' param here to flag that this is
            // initialising the value rather than from user interaction
            // (which sometimes we'll want to ignore). Must be a better way
            // to do this.
            onChange(type, true);
        }
    }

    updateSelectedType(type) {
        if (this.state.selected === type) {
            return;
        }
        this.setState({
            selected: type,
        });
        if (this.props.onChange) {
            this.props.onChange(type);
        }
    }

    onClick = (e) => {
        e.stopPropagation();
        const type = e.currentTarget.dataset.id;
        this.updateSelectedType(type);
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const serverTypes = [];
        for (const type of Object.values(TYPES)) {
            const { id, label, logo, description } = type;
            const classes = classnames(
                "mx_ServerTypeSelector_type",
                `mx_ServerTypeSelector_type_${id}`,
                {
                    "mx_ServerTypeSelector_type_selected": id === this.state.selected,
                },
            );

            serverTypes.push(<div className={classes} key={id} >
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
            </div>);
        }

        return <div className="mx_ServerTypeSelector">
            {serverTypes}
        </div>;
    }
}
