const FIGMA_API_ROOT = "https://api.figma.com/v1";

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required.`);
    }

    return value;
}

function resolveFileKey(fileKey) {
    if (fileKey) {
        return fileKey;
    }

    const envValue = process.env.FIGMA_FILE;
    if (envValue) {
        return envValue;
    }

    throw new Error(
        "No Figma file key provided. Either pass a fileKey parameter or set the FIGMA_FILE environment variable.",
    );
}

async function figmaRequest(pathname, searchParams) {
    const token = requireEnv("FIGMA_TOKEN");
    const url = new URL(`${FIGMA_API_ROOT}${pathname}`);

    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const response = await fetch(url, {
        headers: {
            "X-Figma-Token": token,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Figma API request failed (${response.status} ${response.statusText}): ${text.slice(0, 400)}`);
    }

    return response.json();
}

function compactRecord(entries) {
    return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined && value !== null));
}

function simplifyPaint(paint) {
    if (!paint || paint.visible === false) {
        return undefined;
    }

    return compactRecord({
        type: paint.type,
        opacity: paint.opacity,
        color: paint.color
            ? {
                  r: Number(paint.color.r.toFixed(4)),
                  g: Number(paint.color.g.toFixed(4)),
                  b: Number(paint.color.b.toFixed(4)),
              }
            : undefined,
        blendMode: paint.blendMode,
    });
}

function simplifyEffect(effect) {
    if (!effect || effect.visible === false) {
        return undefined;
    }

    return compactRecord({
        type: effect.type,
        radius: effect.radius,
        spread: effect.spread,
        offset: effect.offset,
        color: effect.color,
    });
}

export function simplifyNode(node, depth = 2) {
    if (!node) {
        return undefined;
    }

    const children = depth > 0 ? node.children?.map((child) => simplifyNode(child, depth - 1)).filter(Boolean) : undefined;
    const fills = node.fills?.map(simplifyPaint).filter(Boolean);
    const strokes = node.strokes?.map(simplifyPaint).filter(Boolean);
    const effects = node.effects?.map(simplifyEffect).filter(Boolean);

    return compactRecord({
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible,
        componentId: node.componentId,
        componentSetId: node.componentSetId,
        description: node.description,
        size: node.absoluteBoundingBox
            ? {
                  x: Number(node.absoluteBoundingBox.x.toFixed(2)),
                  y: Number(node.absoluteBoundingBox.y.toFixed(2)),
                  width: Number(node.absoluteBoundingBox.width.toFixed(2)),
                  height: Number(node.absoluteBoundingBox.height.toFixed(2)),
              }
            : undefined,
        layout: compactRecord({
            layoutMode: node.layoutMode,
            layoutWrap: node.layoutWrap,
            primaryAxisAlignItems: node.primaryAxisAlignItems,
            counterAxisAlignItems: node.counterAxisAlignItems,
            primaryAxisSizingMode: node.primaryAxisSizingMode,
            counterAxisSizingMode: node.counterAxisSizingMode,
            itemSpacing: node.itemSpacing,
            paddingTop: node.paddingTop,
            paddingRight: node.paddingRight,
            paddingBottom: node.paddingBottom,
            paddingLeft: node.paddingLeft,
            layoutSizingHorizontal: node.layoutSizingHorizontal,
            layoutSizingVertical: node.layoutSizingVertical,
            layoutGrow: node.layoutGrow,
            layoutAlign: node.layoutAlign,
        }),
        constraints: node.constraints,
        borderRadius: node.cornerRadius,
        individualStrokeWeights: node.individualStrokeWeights,
        fills: fills?.length ? fills : undefined,
        strokes: strokes?.length ? strokes : undefined,
        effects: effects?.length ? effects : undefined,
        styles: node.styles,
        text:
            node.characters || node.style
                ? compactRecord({
                      characters: node.characters ? node.characters.slice(0, 300) : undefined,
                      style: node.style
                          ? compactRecord({
                                fontFamily: node.style.fontFamily,
                                fontWeight: node.style.fontWeight,
                                fontSize: node.style.fontSize,
                                lineHeightPx: node.style.lineHeightPx,
                                letterSpacing: node.style.letterSpacing,
                                textAlignHorizontal: node.style.textAlignHorizontal,
                                textAlignVertical: node.style.textAlignVertical,
                                textCase: node.style.textCase,
                                textDecoration: node.style.textDecoration,
                            })
                          : undefined,
                  })
                : undefined,
        children: children?.length ? children : undefined,
    });
}

function collectNodesByType(node, acceptedTypes, trail = []) {
    if (!node) {
        return [];
    }

    const path = [...trail, node.name].filter(Boolean);
    const own = acceptedTypes.has(node.type)
        ? [
              compactRecord({
                  id: node.id,
                  name: node.name,
                  type: node.type,
                  path: path.join(" / "),
              }),
          ]
        : [];

    const descendants = node.children?.flatMap((child) => collectNodesByType(child, acceptedTypes, path)) ?? [];
    return [...own, ...descendants];
}

export async function getFigmaMe() {
    return figmaRequest("/me");
}

export async function getFigmaFile(fileKey) {
    fileKey = resolveFileKey(fileKey);
    const file = await figmaRequest(`/files/${fileKey}`);

    return {
        key: fileKey,
        name: file.name,
        version: file.version,
        lastModified: file.lastModified,
        thumbnailUrl: file.thumbnailUrl,
        role: file.role,
        pages: file.document?.children?.map((page) => simplifyNode(page, 1)) ?? [],
        frames: collectNodesByType(file.document, new Set(["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET"])),
    };
}

export async function getFigmaNode(nodeId, depth = 3, fileKey) {
    fileKey = resolveFileKey(fileKey);
    const response = await figmaRequest(`/files/${fileKey}/nodes`, {
        ids: nodeId,
        depth,
    });

    const document = response.nodes?.[nodeId]?.document;
    if (!document) {
        throw new Error(`Node ${nodeId} was not found in file ${fileKey}.`);
    }

    return {
        fileKey,
        nodeId,
        node: simplifyNode(document, depth),
    };
}

export async function getFigmaComponents(limit, fileKey) {
    fileKey = resolveFileKey(fileKey);
    const response = await figmaRequest(`/files/${fileKey}/components`);
    const components = Object.values(response.meta?.components ?? {})
        .map((component) =>
            compactRecord({
                key: component.key,
                name: component.name,
                description: component.description,
                nodeId: component.node_id,
                pageId: component.containing_frame?.pageId,
                pageName: component.containing_frame?.pageName,
                containingFrame: component.containing_frame?.name,
            }),
        )
        .sort((left, right) => left.name.localeCompare(right.name));

    return {
        fileKey,
        count: components.length,
        components: typeof limit === "number" ? components.slice(0, limit) : components,
    };
}