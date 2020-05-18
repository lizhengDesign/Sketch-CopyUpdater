import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const sketch = require("sketch")
const Settings = sketch.Settings
let doc = sketch.getSelectedDocument()
let selectedLayers = doc.selectedLayers
const maxPanelHeight = 480
const panelWidth = 720
const panelMargin = 20
const itemWidth = (panelWidth - panelMargin * 4) / 3
const itemHeight = 60
const scrollBarWidth = 16
const layerType = {
    PAGE: "Page",
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
}
const updateType = {
    KEY: false,
    VALUE: true,
}
const prefernceKey = {
    IS_CHECK: "isCheckOnOpenDocument",
    CHECK_SCOPE: "copyCheckScope",
    KEY: "lzhengCopyUpdaterKey",
}
const readJSONAsObject = (path) => {
    try {
        const data = JSON.parse(fs.readFileSync(path))
        return data
    } catch (error) {
        return {}
    }
}

const readDatafromConfig = () => {
    const copyJSONPath = Settings.documentSettingForKey(doc, prefernceKey.KEY)

    if (!copyJSONPath) {
        sketch.UI.message("No copy JSON file found")
        return undefined
    } else {
        const copyData = readJSONAsObject(copyJSONPath)
        if (Object.keys(copyData).length === 0) {
            sketch.UI.message("❌ The JSON file was removed or contains error. Please select another one or fix it.")
        } else return copyData
    }
    return undefined
}

const resolveValue = (path, data) => {
    let copyValue = path.split(".").reduce((prev, curr) => {
        return prev ? prev[curr] : null
    }, data || self)
    if (typeof copyValue != "string") {
        return undefined
    } else return copyValue
}

const updateTextByType = (type) => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 layer or artboard.")
        return
    }

    const copyData = readDatafromConfig()
    if (!copyData) return

    let updateCounter = 0

    const getCopyFromData = (item, index, value) => {
        let copyKey
        let storedKey = Settings.layerSettingForKey(item, prefernceKey.KEY)
        let displayValue = value
        if (!storedKey) storedKey = {}

        switch (value[0]) {
            case "@":
                copyKey = value.slice(1)
                storedKey[index] = copyKey
                Settings.setLayerSettingForKey(item, prefernceKey.KEY, storedKey)
                break
            case "-":
                if (value[1] == "@") {
                    copyKey = undefined
                    storedKey[index] = copyKey
                    displayValue = value.slice(2)
                    Settings.setLayerSettingForKey(item, prefernceKey.KEY, storedKey)
                } else copyKey = storedKey[index]
                break
            default:
                copyKey = storedKey[index]
        }
        switch (type) {
            case updateType.KEY:
                return copyKey ? "@" + copyKey : displayValue
            case updateType.VALUE:
                const copyValue = copyKey ? resolveValue(copyKey, copyData) : undefined
                if (copyValue && copyValue != displayValue) {
                    updateCounter++
                    return copyValue
                } else return displayValue
        }
    }

    const updateChildrenLayers = (layer) => {
        if (layer.layers == undefined) {
            switch (layer.type) {
                case layerType.TEXT:
                    layer.text = getCopyFromData(layer, 0, layer.text)
                    break
                case layerType.SYMBOLINSTANCE:
                    layer.overrides.forEach((override, index) => {
                        if (override.property == "stringValue" && override.editable) {
                            override.value = getCopyFromData(layer, index, override.value)
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
    if (type == updateType.KEY) {
        sketch.UI.message("📍 Reset without auto-resizing")
    }
    if (type == updateType.VALUE) {
        sketch.UI.message(`🙌 ${updateCounter} text(s) updated`)
    }
}

const getLocatedPageID = (layer) => {
    if (layer.type == layerType.PAGE) {
        return layer.id
    } else {
        return getLocatedPageID(layer.parent)
    }
}

const selectOneLayer = (layer) => {
    doc.selectedLayers.clear()
    layer.selected = true
}

const getUnsyncedPostion = (string1, string2) => {
    let i = 0
    while (i < string1.length && i < string2.length && string1[i] == string2[i]) {
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

const createClickableArea = (layer, override, frame) => {
    let hotspot = NSButton.alloc().initWithFrame(frame)

    hotspot.addCursorRect_cursor(hotspot.frame(), NSCursor.pointingHandCursor())
    hotspot.setTransparent(true)
    hotspot.setAction("callAction:")
    hotspot.setCOSJSTargetFunction((sender) => {
        sender.setWantsLayer(true)
        if (override) {
            selectOneLayer(override)
        } else selectOneLayer(layer)
        doc.getLayerWithID(getLocatedPageID(layer)).selected = true
        doc.centerOnLayer(layer)
    })

    return hotspot
}

const displayUnsyncedCopy = (layerIndex, copyIndex, unsyncedLayers) => {
    const item = unsyncedLayers[layerIndex]
    const copy = item.list[copyIndex]
    const unsyncedPosition = getUnsyncedPostion(copy.sketchCopy, copy.dataCopy)
    const startPosition = unsyncedPosition < 60 ? 0 : unsyncedPosition - 60
    let contentList = []
    let displayedSketchCopy = [
        copy.sketchCopy.slice(0, unsyncedPosition),
        "🔺",
        copy.sketchCopy.slice(unsyncedPosition),
    ]
        .join("")
        .substr(startPosition)
    displayedSketchCopy = startPosition == 0 ? displayedSketchCopy : "..." + displayedSketchCopy
    let displayedDataCopy = [copy.dataCopy.slice(0, unsyncedPosition), "🔺", copy.dataCopy.slice(unsyncedPosition)]
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
        item.type == layerType.SYMBOLINSTANCE ? copy.override : false,
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
        "@" + copy.label,
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

export const checkUpdateOnOpenDocument = (context) => {
    if (!Settings.settingForKey(prefernceKey.IS_CHECK)) return
    setTimeout(() => {
        doc = sketch.fromNative(context.actionContext.document)
        selectedLayers = doc.selectedLayers
        checkUpdate()
    }, 1000)
}

export const checkUpdate = () => {
    const copyData = readDatafromConfig()
    if (!copyData) return

    let unsyncedLayers = []
    let unsyncedCopyAmount = 0

    const createUnsyncedData = (layer, type, list) => {
        return {
            id: layer.id,
            name: layer.name,
            layer: layer,
            type: type,
            selected: true,
            list: list,
        }
    }

    const checkChildrenLayers = (layer) => {
        if (layer.layers == undefined) {
            let storedKey = Settings.layerSettingForKey(layer, prefernceKey.KEY)
            if (!storedKey) return
            switch (layer.type) {
                case layerType.TEXT:
                    const copyKey = storedKey[0]
                    const JSONValue = resolveValue(copyKey, copyData)
                    if (JSONValue && layer.text != JSONValue) {
                        unsyncedLayers.push(
                            createUnsyncedData(layer, layerType.TEXT, [
                                { label: copyKey, sketchCopy: layer.text, dataCopy: JSONValue },
                            ])
                        )
                        unsyncedCopyAmount++
                    }
                    break
                case layerType.SYMBOLINSTANCE:
                    let unsyncedOverride = []
                    layer.overrides.forEach((override, index) => {
                        const copyKey = storedKey[index]
                        if (copyKey && override.property == "stringValue" && override.editable) {
                            const JSONValue = resolveValue(copyKey, copyData)
                            if (JSONValue && override.value != JSONValue) {
                                unsyncedOverride.push({
                                    label: copyKey,
                                    sketchCopy: override.value,
                                    dataCopy: JSONValue,
                                    override: override,
                                })
                                unsyncedCopyAmount++
                            }
                        }
                    })
                    if (unsyncedOverride.length != 0) {
                        unsyncedLayers.push(createUnsyncedData(layer, layerType.SYMBOLINSTANCE, unsyncedOverride))
                    }
                    break
            }
        } else layer.layers.forEach((sublayer) => checkChildrenLayers(sublayer))
    }
    let checkScope = Settings.settingForKey(prefernceKey.CHECK_SCOPE)
        ? Settings.settingForKey(prefernceKey.CHECK_SCOPE)
        : 0
    switch (checkScope) {
        case 0: // Selected page
            doc.pages.forEach((page) => {
                if (page.selected) checkChildrenLayers(page)
            })
            break
        case 1: // Pages starting with "@"
            doc.pages.forEach((page) => {
                if (page.name[0] == "@") checkChildrenLayers(page)
            })
            break
        case 2: // Entire document
            doc.pages.forEach((page) => {
                checkChildrenLayers(page)
            })
            break
        default:
    }

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
        Settings.setDocumentSettingForKey(doc, prefernceKey.KEY, sourceFilePath)
    }
}
