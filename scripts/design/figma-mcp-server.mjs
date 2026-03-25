import { getFigmaComponents, getFigmaFile, getFigmaNode } from "./figma-api.mjs";

const tools = [
    {
        name: "get_figma_file",
        description:
            "Fetch a Figma file and return a simplified page and frame outline. " +
            "Pass a fileKey directly, or omit it to use the FIGMA_FILE environment variable.",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description:
                        "The Figma file key (the alphanumeric ID from a Figma URL, e.g. 'abc123DEF' from figma.com/design/abc123DEF/…). Optional if FIGMA_FILE is set.",
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: "get_figma_node",
        description:
            "Fetch a specific Figma node by id and return a simplified layout tree. " +
            "Pass a fileKey directly, or omit it to use the FIGMA_FILE environment variable.",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description:
                        "The Figma file key. Optional if FIGMA_FILE is set.",
                },
                nodeId: {
                    type: "string",
                    description: "The Figma node id to fetch, for example 12:34.",
                },
                depth: {
                    type: "integer",
                    minimum: 1,
                    maximum: 6,
                    description: "How many nested child levels to include. Defaults to 3.",
                },
            },
            required: ["nodeId"],
            additionalProperties: false,
        },
    },
    {
        name: "get_figma_components",
        description:
            "List components defined in a Figma file. " +
            "Pass a fileKey directly, or omit it to use the FIGMA_FILE environment variable.",
        inputSchema: {
            type: "object",
            properties: {
                fileKey: {
                    type: "string",
                    description:
                        "The Figma file key. Optional if FIGMA_FILE is set.",
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 200,
                    description: "Maximum number of components to return.",
                },
            },
            additionalProperties: false,
        },
    },
];

const serverInfo = {
    name: "element-web-figma",
    version: "0.1.0",
};

function sendMessage(message) {
    const json = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function sendResult(id, result) {
    sendMessage({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
    sendMessage({
        jsonrpc: "2.0",
        id,
        error: {
            code,
            message,
        },
    });
}

async function callTool(name, arguments_) {
    switch (name) {
        case "get_figma_file":
            return getFigmaFile(arguments_?.fileKey);
        case "get_figma_node":
            return getFigmaNode(arguments_?.nodeId, arguments_?.depth ?? 3, arguments_?.fileKey);
        case "get_figma_components":
            return getFigmaComponents(arguments_?.limit, arguments_?.fileKey);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

async function handleMessage(message) {
    if (!message || typeof message !== "object") {
        return;
    }

    const { id, method, params } = message;

    try {
        switch (method) {
            case "initialize":
                sendResult(id, {
                    protocolVersion: params?.protocolVersion ?? "2024-11-05",
                    capabilities: {
                        tools: {},
                    },
                    serverInfo,
                });
                return;
            case "notifications/initialized":
                return;
            case "ping":
                sendResult(id, {});
                return;
            case "tools/list":
                sendResult(id, { tools });
                return;
            case "tools/call": {
                const result = await callTool(params?.name, params?.arguments ?? {});
                sendResult(id, {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                    structuredContent: result,
                });
                return;
            }
            default:
                sendError(id, -32601, `Method not found: ${method}`);
        }
    } catch (error) {
        sendError(id, -32000, error instanceof Error ? error.message : String(error));
    }
}

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
            return;
        }

        const headerText = buffer.subarray(0, headerEnd).toString("utf8");
        const contentLengthHeader = headerText
            .split("\r\n")
            .map((line) => line.split(":", 2))
            .find(([name]) => name.toLowerCase() === "content-length");

        if (!contentLengthHeader) {
            buffer = buffer.subarray(headerEnd + 4);
            continue;
        }

        const contentLength = Number.parseInt(contentLengthHeader[1].trim(), 10);
        const messageStart = headerEnd + 4;
        const messageEnd = messageStart + contentLength;
        if (buffer.length < messageEnd) {
            return;
        }

        const body = buffer.subarray(messageStart, messageEnd).toString("utf8");
        buffer = buffer.subarray(messageEnd);

        handleMessage(JSON.parse(body));
    }
});