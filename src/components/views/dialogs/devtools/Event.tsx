/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, useContext, useMemo, useRef, useState } from "react";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t, _td } from "../../../../languageHandler";
import Field from "../../elements/Field";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import withValidation from "../../elements/Validation";
import SyntaxHighlight from "../../elements/SyntaxHighlight";

export const stringify = (object: object): string => {
    return JSON.stringify(object, null, 2);
};

interface IEventEditorProps extends Pick<IDevtoolsProps, "onBack"> {
    fieldDefs: IFieldDef[]; // immutable
    defaultContent?: string;
    onSend(fields: string[], content?: IContent): Promise<unknown>;
}

interface IFieldDef {
    id: string;
    label: string; // _td
    default?: string;
}

export const eventTypeField = (defaultValue?: string): IFieldDef => ({
    id: "eventType",
    label: _td("Event Type"),
    default: defaultValue,
});

export const stateKeyField = (defaultValue?: string): IFieldDef => ({
    id: "stateKey",
    label: _td("State Key"),
    default: defaultValue,
});

const validateEventContent = withValidation<any, Error | undefined>({
    async deriveData({ value }) {
        try {
            JSON.parse(value!);
        } catch (e) {
            return e as Error;
        }
        return undefined;
    },
    rules: [
        {
            key: "validJson",
            test: ({ value }, error) => {
                if (!value) return true;
                return !error;
            },
            invalid: (error) => _t("Doesn't look like valid JSON.") + " " + error,
        },
    ],
});

export const EventEditor: React.FC<IEventEditorProps> = ({ fieldDefs, defaultContent = "{\n\n}", onSend, onBack }) => {
    const [fieldData, setFieldData] = useState<string[]>(fieldDefs.map((def) => def.default ?? ""));
    const [content, setContent] = useState<string>(defaultContent);
    const contentField = useRef<Field>(null);

    const fields = fieldDefs.map((def, i) => (
        <Field
            key={def.id}
            id={def.id}
            label={_t(def.label)}
            size={42}
            autoFocus={defaultContent === undefined && i === 0}
            type="text"
            autoComplete="on"
            value={fieldData[i]}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                setFieldData((data) => {
                    data[i] = ev.target.value;
                    return [...data];
                })
            }
        />
    ));

    const onAction = async (): Promise<string | undefined> => {
        const valid = contentField.current ? await contentField.current.validate({}) : false;

        if (!valid) {
            contentField.current?.focus();
            contentField.current?.validate({ focused: true });
            return;
        }

        try {
            const json = JSON.parse(content);
            await onSend(fieldData, json);
        } catch (e) {
            return _t("Failed to send event!") + ` (${e.toString()})`;
        }
        return _t("Event sent!");
    };

    return (
        <BaseTool actionLabel={_t("Send")} onAction={onAction} onBack={onBack}>
            <div className="mx_DevTools_eventTypeStateKeyGroup">{fields}</div>

            <Field
                id="evContent"
                label={_t("Event Content")}
                type="text"
                className="mx_DevTools_textarea"
                autoComplete="off"
                value={content}
                onChange={(ev) => setContent(ev.target.value)}
                element="textarea"
                onValidate={validateEventContent}
                ref={contentField}
                autoFocus={!!defaultContent}
            />
        </BaseTool>
    );
};

export interface IEditorProps extends Pick<IDevtoolsProps, "onBack"> {
    mxEvent?: MatrixEvent;
}

interface IViewerProps extends Required<IEditorProps> {
    Editor: React.FC<IEditorProps>;
}

export const EventViewer: React.FC<IViewerProps> = ({ mxEvent, onBack, Editor }) => {
    const [editing, setEditing] = useState(false);

    if (editing) {
        const onBack = (): void => {
            setEditing(false);
        };
        return <Editor mxEvent={mxEvent} onBack={onBack} />;
    }

    const onAction = async (): Promise<void> => {
        setEditing(true);
    };

    return (
        <BaseTool onBack={onBack} actionLabel={_t("Edit")} onAction={onAction}>
            <SyntaxHighlight language="json">{stringify(mxEvent.event)}</SyntaxHighlight>
        </BaseTool>
    );
};

// returns the id of the initial message, not the id of the previous edit
const getBaseEventId = (baseEvent: MatrixEvent): string => {
    // show the replacing event, not the original, if it is an edit
    const mxEvent = baseEvent.replacingEvent() ?? baseEvent;
    return mxEvent.getWireContent()["m.relates_to"]?.event_id ?? baseEvent.getId()!;
};

export const TimelineEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [eventTypeField(mxEvent?.getType())], [mxEvent]);

    const onSend = ([eventType]: string[], content?: IContent): Promise<unknown> => {
        return cli.sendEvent(context.room.roomId, eventType, content || {});
    };

    let defaultContent: string | undefined;

    if (mxEvent) {
        const originalContent = mxEvent.getContent();
        // prefill an edit-message event, keep only the `body` and `msgtype` fields of originalContent
        const bodyToStartFrom = originalContent["m.new_content"]?.body ?? originalContent.body; // prefill the last edit body, to start editing from there
        const newContent = {
            "body": ` * ${bodyToStartFrom}`,
            "msgtype": originalContent.msgtype,
            "m.new_content": {
                body: bodyToStartFrom,
                msgtype: originalContent.msgtype,
            },
            "m.relates_to": {
                rel_type: "m.replace",
                event_id: getBaseEventId(mxEvent),
            },
        };

        defaultContent = stringify(newContent);
    }

    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};
