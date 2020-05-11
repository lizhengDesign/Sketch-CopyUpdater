import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const sketch = require("sketch")
const documentID = sketch.getSelectedDocument().id
const resourcePath =
    context.scriptPath.stringByDeletingLastPathComponent().stringByDeletingLastPathComponent() + "/Resources/"
const copyConfigFilePath = resourcePath + "copyConfig.json"
const copyKeyValuePairPath = resourcePath + documentID + ".json"
const doc = sketch.getSelectedDocument()
const selectedLayers = doc.selectedLayers
const panelHeight = 480
const panelWidth = 350
const layerType = {
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
}
const updateType = {
    KEY: false,
    VALUE: true,
}
const readJSONAsObject = (path) => {
    try {
        const data = JSON.parse(fs.readFileSync(path))
        return data
    } catch (error) {
        return {}
    }
}
let storedCopyConfig = readJSONAsObject(copyConfigFilePath)
let storedCopyKeyValuePair = readJSONAsObject(copyKeyValuePairPath)

const readDatafromConfig = () => {
    const copyJSONPath = storedCopyConfig[documentID]

    if (!copyJSONPath) {
        sketch.UI.message("❌ Please setup a JSON file first")
    } else {
        const copyData = readJSONAsObject(copyJSONPath)
        if (Object.keys(copyData).length === 0) {
            sketch.UI.message("❌ The JSON file was removed or contains error. Please select another one or fix it.")
        } else return copyData
    }
    return undefined
}

const updateCopyConfig = (JSONPath) => {
    storedCopyConfig[documentID] = JSONPath
    fs.writeFileSync(copyConfigFilePath, JSON.stringify(storedCopyConfig))
    fs.writeFileSync(copyKeyValuePairPath, JSON.stringify(storedCopyKeyValuePair))
}

const resolveValue = (path, data) => {
    return path.split(".").reduce((prev, curr) => {
        return prev ? prev[curr] : null
    }, data || self)
}

const updateTextByType = (type) => {
    if (selectedLayers.length === 0) {
        sketch.UI.message("❌ Please select at least 1 layer or artboard.")
        return
    }

    const copyData = readDatafromConfig()
    if (!copyData) return

    let updateCounter = 0

    const getCopyFromData = (id, value) => {
        let copyKey
        if (value[0] == "@") {
            copyKey = value.slice(1)
            storedCopyKeyValuePair[id] = copyKey
        } else {
            copyKey = storedCopyKeyValuePair[id]
        }
        const copyValue = copyKey ? resolveValue(copyKey, copyData) : undefined
        switch (type) {
            case updateType.KEY:
                return copyKey ? "@" + copyKey : value
            case updateType.VALUE:
                if (copyValue && copyValue != value) {
                    updateCounter++
                    return copyValue
                } else return value
        }
    }

    const updateChildrenLayers = (layer) => {
        if (layer.layers == undefined) {
            switch (layer.type) {
                case layerType.TEXT:
                    layer.text = getCopyFromData(layer.id, layer.text)
                    break
                case layerType.SYMBOLINSTANCE:
                    layer.overrides.forEach((override) => {
                        if (override.property == "stringValue" && override.editable) {
                            override.value = getCopyFromData(layer.id + "/" + override.id, override.value)
                        }
                    })
                    if (type == updateType.VALUE) {
                        layer.resizeWithSmartLayout()
                    }
                    break
            }
            return
        } else {
            layer.layers.forEach((sublayer) => {
                updateChildrenLayers(sublayer)
            })
        }
    }

    selectedLayers.forEach((layer) => {
        updateChildrenLayers(layer)
    })
    fs.writeFileSync(copyKeyValuePairPath, JSON.stringify(storedCopyKeyValuePair))
    if (type == updateType.KEY) {
        sketch.UI.message("📍 Reset without auto-resizing")
    }
    if (type == updateType.VALUE) {
        sketch.UI.message(`🙌 ${updateCounter} text(s) updated`)
    }
}

function createView(frame) {
    var view = NSView.alloc().initWithFrame(frame)
    view.setFlipped(1)
    return view
}

function createTextLabel(string, frame) {
    var label = NSTextField.alloc().initWithFrame(frame)

    label.setStringValue(string)
    label.setFont(NSFont.systemFontOfSize(9))
    label.setTextColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0.4))
    label.setBezeled(0)
    label.setEditable(0)

    return label
}

const createFloatingPanel = (title, frame) => {
    var panel = NSPanel.alloc().init()

    panel.setTitle(title)
    panel.setFrame_display(frame, true)
    panel.setStyleMask(
        NSTexturedBackgroundWindowMask | NSTitledWindowMask | NSClosableWindowMask | NSFullSizeContentViewWindowMask
    )
    panel.setBackgroundColor(NSColor.controlColor())
    panel.setLevel(NSFloatingWindowLevel)
    panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true)
    panel.standardWindowButton(NSWindowZoomButton).setHidden(true)
    panel.makeKeyAndOrderFront(null)
    panel.center()

    return panel
}

const displayUnsyncedCopy = () => {
    var instanceHeight = 96
    var instanceWidth = panelWidth
    var instanceContent = createView(NSMakeRect(0, 0, instanceWidth, instanceHeight))
    var artboardLabel = createTextLabel("Current Copy", NSMakeRect(0, 6, 500, 14))
    instanceContent.addSubview(artboardLabel)
    return instanceContent
}

export const checkUpdate = () => {
    let unsyncedCopyCounter = 0
    const copyData = readDatafromConfig()
    if (!copyData) return
    // var panel = createFloatingPanel("pluginName", NSMakeRect(0, 0, panelWidth, panelHeight))
    // panel.contentView().addSubview(displayUnsyncedCopy())

    let syncedLayers = {}
    Object.keys(storedCopyKeyValuePair).forEach((copyID) => {
        syncedLayers[copyID.split("/")[0]] = true
    })

    Object.keys(syncedLayers).forEach((syncedLayerID) => {
        const syncedLayer = doc.getLayerWithID(syncedLayerID)
        if (syncedLayer) {
            switch (syncedLayer.type) {
                case layerType.TEXT:
                    break
                case layerType.SYMBOLINSTANCE:
                    syncedLayer.overrides.forEach((override) => {
                        const copyKey = storedCopyKeyValuePair[syncedLayerID + "/" + override.id]
                        if (copyKey && override.property == "stringValue" && override.editable) {
                            const JSONValue = resolveValue(copyKey, copyData)
                            if (override.value != JSONValue) {
                                log("Curr:" + override.value)
                                log("Data:" + JSONValue)
                                unsyncedCopyCounter++
                            }
                        }
                    })
                    break
            }
        }
    })

    sketch.UI.message(`🙌 ${unsyncedCopyCounter} unsynced text(s) found`)
}

export const resetCopy = () => {
    updateTextByType(updateType.KEY)
}

export const updateCopy = () => {
    updateTextByType(updateType.VALUE)
}

export const setupJSON = () => {
    const selectedFile = dialog.showOpenDialogSync({
        properties: ["openFile"],
        filters: [{ extensions: ["json"] }],
    })
    const sourceFilePath = selectedFile[0]
    if (sourceFilePath) {
        updateCopyConfig(sourceFilePath)
    }
}
