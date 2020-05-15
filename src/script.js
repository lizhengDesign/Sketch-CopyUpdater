import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const sketch = require("sketch")
const documentID = sketch.getSelectedDocument().id
const resourcePath =
    context.scriptPath.stringByDeletingLastPathComponent().stringByDeletingLastPathComponent() + "/Resources/"
const copyConfigFilePath = resourcePath + "copyConfig.json"
const copyKeyValuePairPath = resourcePath + documentID + ".json"
const doc = sketch.getSelectedDocument()
let selectedLayers = doc.selectedLayers
const maxPanelHeight = 480
const panelWidth = 720
const panelMargin = 20
const itemWidth = (panelWidth - panelMargin * 4) / 3
const itemHeight = 60
const scrollBarWidth = 16
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

const selectOneLayer = (layer) => {
    doc.selectedLayers.clear()
    layer.selected = true
}

const compare2Strings = (string1, string2) => {
    let i = 0
    while (string1[i] == string2[i] && i < string1.length) {
        i++
    }

    return i
}
const createButton = (label, frame) => {
    const button = NSButton.alloc().initWithFrame(frame)

    button.setTitle(label)
    button.setBezelStyle(NSRoundedBezelStyle)
    button.setAction("callAction:")

    return button
}

const createToggle = (frame) => {
    const toggle = NSButton.alloc().initWithFrame(frame)

    toggle.setButtonType(NSSwitchButton)
    toggle.setBezelStyle(0)
    toggle.setTitle("")
    toggle.setState(true)

    return toggle
}

const createView = (frame) => {
    const view = NSView.alloc().initWithFrame(frame)
    view.setFlipped(true)
    return view
}

const createDivider = (frame) => {
    const divider = NSView.alloc().initWithFrame(frame)

    divider.setWantsLayer(1)
    divider.layer().setBackgroundColor(CGColorCreateGenericRGB(0.8, 0.8, 0.8, 1.0))

    return divider
}

const createTextLabel = (text, frame) => {
    const label = NSTextField.alloc().initWithFrame(frame)

    label.setStringValue(text)
    label.setFont(NSFont.systemFontOfSize(9))
    label.setTextColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0.4))
    label.setBackgroundColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0))
    label.setBezeled(false)
    label.setEditable(false)
    label.setSelectable(false)
    label.setLineBreakMode(NSLineBreakByTruncatingTail)

    return label
}

const createCopyContent = (text, frame, lineBreakMode) => {
    const copy = NSTextField.alloc().initWithFrame(frame)

    copy.setStringValue(text)
    copy.setFont(NSFont.systemFontOfSize(12))
    copy.setTextColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0.7))
    copy.setBackgroundColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0))
    copy.setBezeled(false)
    copy.setEditable(false)
    copy.setSelectable(false)
    copy.setLineBreakMode(lineBreakMode)

    return copy
}

const createScrollView = (frame) => {
    const panel = NSScrollView.alloc().initWithFrame(frame)

    panel.setHasVerticalScroller(true)
    panel.addSubview(createDivider(NSMakeRect(0, 0, frame.size.width, 1)))
    panel.addSubview(createDivider(NSMakeRect(0, frame.size.height - 1, frame.size.width, 1)))

    return panel
}

const createPopupDialog = (title, frame) => {
    const panel = NSPanel.alloc().init()

    panel.setTitle(title)
    panel.setFrame_display(frame, true)
    panel.setStyleMask(
        NSTexturedBackgroundWindowMask | NSTitledWindowMask | NSClosableWindowMask | NSFullSizeContentViewWindowMask
    )
    panel.setBackgroundColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0.9, 0.9, 0.9, 1))
    panel.setLevel(NSFloatingWindowLevel)
    panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true)
    panel.standardWindowButton(NSWindowZoomButton).setHidden(true)
    panel.makeKeyAndOrderFront(null)
    panel.center()

    return panel
}

const createClickableArea = (layer, frame) => {
    let hotspot = NSButton.alloc().initWithFrame(frame)

    hotspot.addCursorRect_cursor(hotspot.frame(), NSCursor.pointingHandCursor())
    hotspot.setTransparent(true)
    hotspot.setAction("callAction:")
    hotspot.setCOSJSTargetFunction((sender) => {
        sender.setWantsLayer(true)
        selectOneLayer(layer)
        doc.centerOnLayer(layer)
    })

    return hotspot
}

const displayUnsyncedCopy = (layerIndex, copyIndex, unsyncedLayers) => {
    const item = unsyncedLayers[layerIndex]
    const unsyncedPosition = compare2Strings(item.list[copyIndex].sketchCopy, item.list[copyIndex].dataCopy)
    const startPosition = unsyncedPosition < 60 ? 0 : unsyncedPosition - 60
    let contentList = []
    let displayedSketchCopy = [
        item.list[copyIndex].sketchCopy.slice(0, unsyncedPosition),
        "🔺",
        item.list[copyIndex].sketchCopy.slice(unsyncedPosition),
    ]
        .join("")
        .substr(startPosition)
    displayedSketchCopy = startPosition == 0 ? displayedSketchCopy : "..." + displayedSketchCopy
    let displayedDataCopy = [
        item.list[copyIndex].dataCopy.slice(0, unsyncedPosition),
        "🔺",
        item.list[copyIndex].dataCopy.slice(unsyncedPosition),
    ]
        .join("")
        .substr(startPosition)
    displayedDataCopy = startPosition == 0 ? displayedDataCopy : "..." + displayedDataCopy

    const copySetFrame = createView(
        NSMakeRect(
            panelMargin * 2,
            (itemHeight + panelMargin) * copyIndex + panelMargin / 2,
            panelWidth - panelMargin * 2,
            itemHeight + panelMargin
        )
    )
    const copySetConetent = createView(NSMakeRect(0, panelMargin / 2, panelWidth - panelMargin * 2, itemHeight))
    const clickableArea = createClickableArea(
        item.layer,
        NSMakeRect(0, 0, panelWidth - panelMargin * 2, itemHeight + panelMargin)
    )

    contentList = [copySetConetent, clickableArea]
    contentList.forEach((item) => copySetFrame.addSubview(item))

    const copyLayerName = createCopyContent(
        item.name,
        NSMakeRect(panelMargin, 0, itemWidth - panelMargin * 2, itemHeight),
        NSLineBreakByTruncatingTail
    )
    const copyLabel = createTextLabel(
        "@" + item.list[copyIndex].label,
        NSMakeRect(panelMargin, panelMargin, itemWidth - panelMargin * 2, itemHeight),
        NSLineBreakByTruncatingTail
    )
    const sketchCopyContent = createCopyContent(
        displayedSketchCopy,
        NSMakeRect(itemWidth, 0, itemWidth, itemHeight),
        NSLineBreakByWordWrapping
    )
    const dataCopyContent = createCopyContent(
        displayedDataCopy,
        NSMakeRect(itemWidth * 2 + panelMargin, 0, itemWidth, itemHeight),
        NSLineBreakByWordWrapping
    )

    contentList = [copyLayerName, copyLabel, sketchCopyContent, dataCopyContent]
    contentList.forEach((item) => copySetConetent.addSubview(item))

    return copySetFrame
}

const displayResult = (unsyncedLayers, unsyncedCopyAmount) => {
    let totalHeight =
        unsyncedCopyAmount * (itemHeight + panelMargin) + unsyncedLayers.length * panelMargin + panelMargin * 4
    const panelHeight = totalHeight < maxPanelHeight ? totalHeight : maxPanelHeight
    let prevCopyAmount = 0
    let dialog = createPopupDialog(
        "Review Unsynced Copy",
        NSMakeRect(0, 0, panelWidth + scrollBarWidth, panelHeight + 44)
    )
    let fiber = sketch.Async.createFiber()
    let dialogClose = dialog.standardWindowButton(NSWindowCloseButton)
    dialogClose.setCOSJSTargetFunction(function () {
        dialog.close()
        fiber.cleanup()
    })

    let dialogContent = createView(NSMakeRect(0, 0, panelWidth + scrollBarWidth, panelHeight))

    const layerLabel = createTextLabel("Unsynced layer", NSMakeRect(panelMargin, panelMargin, itemWidth, panelMargin))
    const sketchCopyLable = createTextLabel(
        "Text in Sketch",
        NSMakeRect(itemWidth + panelMargin * 2, panelMargin, itemWidth, panelMargin)
    )
    const dataCopyLabel = createTextLabel(
        "Text in JSON",
        NSMakeRect(itemWidth * 2 + panelMargin * 3, panelMargin, itemWidth, panelMargin)
    )
    const resultListScrollView = createScrollView(
        NSMakeRect(0, panelMargin * 2, panelWidth + scrollBarWidth, panelHeight - panelMargin * 4)
    )
    const resultListScrollContent = createView(NSMakeRect(0, 0, panelWidth, totalHeight - panelMargin * 4))
    unsyncedLayers.forEach((item, i) => {
        const layerFrame = createView(
            NSMakeRect(
                0,
                panelMargin * i + (panelMargin + itemHeight) * prevCopyAmount,
                panelWidth,
                panelMargin + (itemHeight + panelMargin) * item.list.length
            )
        )
        const topDivider = createDivider(NSMakeRect(0, 0, panelWidth, 1))
        const syncToggle = createToggle(NSMakeRect(panelMargin, panelMargin, 36, 36))

        layerFrame.addSubview(syncToggle)
        layerFrame.addSubview(topDivider)
        syncToggle.setCOSJSTargetFunction((sender) => (item.selected = sender.state()))
        resultListScrollContent.addSubview(layerFrame)

        item.list.forEach((copy, j) => {
            layerFrame.addSubview(displayUnsyncedCopy(i, j, unsyncedLayers))
        })
        prevCopyAmount += item.list.length
    })
    resultListScrollView.setDocumentView(resultListScrollContent)

    const cancelButton = createButton("Cancel", NSMakeRect(panelWidth - 220, panelHeight - panelMargin * 1.9, 80, 36))
    const updateButton = createButton(
        "Update Selected",
        NSMakeRect(panelWidth - 140, panelHeight - panelMargin * 1.9, 140, 36)
    )

    const dialogContentList = [
        layerLabel,
        sketchCopyLable,
        dataCopyLabel,
        resultListScrollView,
        cancelButton,
        updateButton,
    ]
    dialogContentList.forEach((item) => dialogContent.addSubview(item))

    dialog.contentView().addSubview(dialogContent)

    cancelButton.setCOSJSTargetFunction(function () {
        dialog.close()
        fiber.cleanup()
    })

    updateButton.setCOSJSTargetFunction(function () {
        doc.selectedLayers.clear()
        unsyncedLayers.forEach((item) => (item.layer.selected = item.selected))
        updateCopy()
        dialog.close()
        fiber.cleanup()
    })
}

export const checkUpdate = () => {
    const copyData = readDatafromConfig()
    if (!copyData) return

    let copyLayers = {}
    let unsyncedLayers = []
    let unsyncedCopyAmount = 0

    Object.keys(storedCopyKeyValuePair).forEach((copyID) => {
        copyLayers[copyID.split("/")[0]] = { isSynced: true, list: [] }
    })

    Object.keys(copyLayers).forEach((layerID) => {
        const syncedLayer = doc.getLayerWithID(layerID)
        if (syncedLayer) {
            switch (syncedLayer.type) {
                case layerType.TEXT:
                    const copyKey = storedCopyKeyValuePair[layerID]
                    const JSONValue = resolveValue(copyKey, copyData)
                    if (syncedLayer.text != JSONValue) {
                        copyLayers[layerID].isSynced = false
                        copyLayers[layerID].layer = syncedLayer
                        copyLayers[layerID].name = syncedLayer.name
                        copyLayers[layerID].type = layerType.TEXT
                        copyLayers[layerID].list.push({
                            label: copyKey,
                            sketchCopy: syncedLayer.text,
                            dataCopy: JSONValue,
                        })
                    }
                    break
                case layerType.SYMBOLINSTANCE:
                    syncedLayer.overrides.forEach((override) => {
                        const copyKey = storedCopyKeyValuePair[layerID + "/" + override.id]
                        if (copyKey && override.property == "stringValue" && override.editable) {
                            const JSONValue = resolveValue(copyKey, copyData)
                            if (override.value != JSONValue) {
                                copyLayers[layerID].isSynced = false
                                copyLayers[layerID].layer = syncedLayer
                                copyLayers[layerID].name = syncedLayer.name
                                copyLayers[layerID].type = layerType.SYMBOLINSTANCE
                                copyLayers[layerID].list.push({
                                    label: copyKey,
                                    sketchCopy: override.value,
                                    dataCopy: JSONValue,
                                })
                            }
                        }
                    })
                    break
            }
        }
    })
    Object.keys(copyLayers).forEach((layerID) => {
        if (!copyLayers[layerID].isSynced) {
            unsyncedCopyAmount += copyLayers[layerID].list.length
            unsyncedLayers.push({
                id: layerID,
                selected: true,
                name: copyLayers[layerID].name,
                layer: copyLayers[layerID].layer,
                type: copyLayers[layerID].type,
                list: copyLayers[layerID].list,
            })
        }
    })
    if (unsyncedLayers.length !== 0) {
        displayResult(unsyncedLayers, unsyncedCopyAmount)
    } else {
        sketch.UI.message("🙌 No unsynced texts found")
    }
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
