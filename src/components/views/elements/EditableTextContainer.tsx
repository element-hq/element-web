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

import React from "react";

import Spinner from "./Spinner";
import EditableText from "./EditableText";

interface IProps {
    /* callback to retrieve the initial value. */
    getInitialValue?: () => Promise<string>;

    /* initial value; used if getInitialValue is not given */
    initialValue?: string;

    /* placeholder text to use when the value is empty (and not being
     * edited) */
    placeholder?: string;

    /* callback to update the value. Called with a single argument: the new
     * value. */
    onSubmit: (value: string) => Promise<{} | void>;

    /* should the input submit when focus is lost? */
    blurToSubmit?: boolean;
}

interface IState {
    busy: boolean;
    errorString: string | null;
    value: string;
}

/**
 * A component which wraps an EditableText, with a spinner while updates take
 * place.
 *
 * Parent components should supply an 'onSubmit' callback which returns a
 * promise; a spinner is shown until the promise resolves.
 *
 * The parent can also supply a 'getInitialValue' callback, which works in a
 * similarly asynchronous way. If this is not provided, the initial value is
 * taken from the 'initialValue' property.
 */
export default class EditableTextContainer extends React.Component<IProps, IState> {
    private unmounted = false;
    public static defaultProps: Partial<IProps> = {
        initialValue: "",
        placeholder: "",
        blurToSubmit: false,
        onSubmit: () => {
            return Promise.resolve();
        },
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
            errorString: null,
            value: props.initialValue ?? "",
        };
    }

    public async componentDidMount(): Promise<void> {
        // use whatever was given in the initialValue property.
        if (this.props.getInitialValue === undefined) return;

        this.setState({ busy: true });
        try {
            const initialValue = await this.props.getInitialValue();
            if (this.unmounted) return;
            this.setState({
                busy: false,
                value: initialValue,
            });
        } catch (error) {
            if (this.unmounted) return;
            this.setState({
                errorString: error.toString(),
                busy: false,
            });
        }
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onValueChanged = (value: string, shouldSubmit: boolean): void => {
        if (!shouldSubmit) {
            return;
        }

        this.setState({
            busy: true,
            errorString: null,
        });

        this.props.onSubmit(value).then(
            () => {
                if (this.unmounted) {
                    return;
                }
                this.setState({
                    busy: false,
                    value: value,
                });
            },
            (error) => {
                if (this.unmounted) {
                    return;
                }
                this.setState({
                    errorString: error.toString(),
                    busy: false,
                });
            },
        );
    };

    public render(): React.ReactNode {
        if (this.state.busy) {
            return <Spinner />;
        } else if (this.state.errorString) {
            return <div className="error">{this.state.errorString}</div>;
        } else {
            return (
                <EditableText
                    initialValue={this.state.value}
                    placeholder={this.props.placeholder}
                    onValueChanged={this.onValueChanged}
                    blurToSubmit={this.props.blurToSubmit}
                />
            );
        }
    }
}
