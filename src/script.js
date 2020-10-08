import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const sketch = require("sketch")
const Settings = sketch.Settings
let doc = sketch.getSelectedDocument()
let selectedLayers = doc.selectedLayers
const maxPanelHeight = 480
const panelMargin = 20
const itemWidth = 200
const panelWidth = itemWidth * 3 + panelMargin * 6
const itemHeight = 60
const scrollBarWidth = 16
const layerType = {
    PAGE: "Page",
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
    SYMBOLMASTER: "SymbolMaster",
}
const updateType = {
    KEY: 0,
    FROM_JSON: 1,
    TO_JSON: 2,
    MIXED: 3,
}
const updateDirection = {
    TO_JSON: true,
    FROM_JSON: false,
}
const prefernceKey = {
    IS_CHECK: "isCheckOnOpenDocument",
    HAS_DOCUMENTATION: "hasCopyDocumentation",
    CHECK_SCOPE: "copyCheckScope",
    KEY: "lzhengCopyUpdaterKey",
    UPDATE_DIRECTION: "lzhengCopyUpdaterDirection",
    COPY_GROUP_CONFIG: "lzhengCopyUpdaterCopyConfig",
    COPY_PAGE_ID: "lzhengCopyUpdaterIndexPageId",
}
const copyBlockSpec = {
    secondaryMargin: 4,
    primaryMargin: 16,
    sectionMargin: 64,
    keyStyle: {
        textColor: "#00000099",
        fontSize: 14,
        lineHeight: 16,
        fontWeight: 4,
        alignment: sketch.Text.Alignment.left,
    },
    valueStyle: {
        textColor: "#000000EE",
        fontSize: 16,
        lineHeight: 20,
        fontWeight: 8,
        alignment: sketch.Text.Alignment.left,
    },
    copyPageName: "[Copy Index]",
    copyPrefix: "[Copy]: ",
    copyBlockWidth: 500,
    copyTitleHeight: 60,
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
            sketch.UI.message(
                "❌ The JSON file was removed, empty, or contains error. Please select another one or fix it."
            )
        } else return copyData
    }
    return undefined
}

const resolveValue = (path, data) => {
    if (!path) return undefined
    let copyValue = path.split(/\.|\]\.|\[|\]\[|\]/).reduce((prev, curr) => {
        if (curr === "") return prev
        return prev ? prev[curr] : null
    }, data || self)
    if (typeof copyValue != "string") {
        return undefined
    } else return copyValue
}

const setValue = (path, data, value) => {
    let pathList = path.split(".")
    pathList.reduce((prev, curr, index) => {
        if (index == pathList.length - 1) {
            prev[curr] = value
        }
        if (!prev[curr]) prev[curr] = {}
        return prev ? prev[curr] : null
    }, data || self)
}

const createCopyKeyValueGroup = (copyKey, JSONValue, parentGroup, index) => {
    let key = new sketch.Text({
        text: copyKey,
        parent: parentGroup,
        fixedWidth: true,
        style: copyBlockSpec.keyStyle,
        frame: {
            x: 0,
            y:
                index == 0
                    ? parentGroup.frame.height + copyBlockSpec.sectionMargin
                    : parentGroup.frame.height + copyBlockSpec.primaryMargin,
            width: copyBlockSpec.copyBlockWidth,
            height: 0,
        },
    }).adjustToFit()
    let value = new sketch.Text({
        text: JSONValue,
        parent: parentGroup,
        fixedWidth: true,
        style: copyBlockSpec.valueStyle,
        frame: {
            x: 0,
            y: key.frame.y + key.frame.height + copyBlockSpec.secondaryMargin,
            width: copyBlockSpec.copyBlockWidth,
            height: 0,
        },
    }).adjustToFit()
    new sketch.Group({
        name: copyKey,
        parent: parentGroup,
        layers: [value, key],
    })
        .adjustToFit()
        .moveToBack()
    parentGroup.adjustToFit()
}

const updateText = (layer, value) => {
    if (layer.type == layerType.TEXT) {
        layer.text = value
    } else layer.value = value
}

const getFileName = (path) => {
    if (!path) return undefined
    let name = path.substr(path.lastIndexOf("/") + 1)
    name = name.lastIndexOf(".") != -1 ? name.substr(0, name.lastIndexOf(".")) : name
    return name
}

const syncCopyDoc = (copyData) => {
    let JSONPath = Settings.documentSettingForKey(doc, prefernceKey.KEY)
    let JSONName = getFileName(JSONPath)
    let copyPageId = Settings.documentSettingForKey(doc, prefernceKey.COPY_PAGE_ID)
    let copyPage = doc.getLayerWithID(copyPageId)
        ? doc.getLayerWithID(copyPageId)
        : new sketch.Page({
            name: copyBlockSpec.copyPageName + " (Reference Only)",
            parent: doc,
        })
    Settings.setDocumentSettingForKey(doc, prefernceKey.COPY_PAGE_ID, copyPage.id)
    let copyGroupConfig = Settings.layerSettingForKey(copyPage, prefernceKey.COPY_GROUP_CONFIG)
        ? Settings.layerSettingForKey(copyPage, prefernceKey.COPY_GROUP_CONFIG)
        : {}
    let copyGroup = doc.getLayerWithID(copyGroupConfig[JSONPath])
        ? doc.getLayerWithID(copyGroupConfig[JSONPath])
        : new sketch.Group({
            name: copyBlockSpec.copyPageName + ": " + JSONName,
            parent: copyPage,
        })
    copyGroupConfig[JSONPath] = copyGroup.id
    copyGroup.layers.forEach((layer) => layer.remove())
    copyGroup.frame.y -= copyBlockSpec.sectionMargin
    copyGroup.frame.height = 0
    Settings.setLayerSettingForKey(copyPage, prefernceKey.COPY_GROUP_CONFIG, copyGroupConfig)
    const traverseData = (key, data, index) => {
        if (typeof data == "string") {
            createCopyKeyValueGroup(key, data, copyGroup, index ? index : 0)
        } else {
            Object.keys(data).forEach((nextKey, index) => traverseData(key + "." + nextKey, data[nextKey], index))
        }
    }

    Object.keys(copyData).forEach((key) => traverseData("@" + key, copyData[key]))
}

const camelize = (string) => {
    return string
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase()
        })
        .replace(/\s+/g, "")
}

const getFullName = (instance, copyItem) => {
    let symbolDoc = instance.master.getLibrary() == null ? doc : instance.master.getLibrary().getDocument()
    let pathList = copyItem.path.split("/")
    let name = ""
    pathList.forEach((id) => {
        const element = symbolDoc.getLayerWithID(id)
        if (element != undefined) {
            name += camelize(element.name) + "."
            if (element.type != layerType.TEXT) {
                symbolDoc = element.master.getLibrary() == null ? symbolDoc : element.master.getLibrary().getDocument()
            }
        }
    })
    name = name.substr(0, name.length - 1)
    return name
}

const updateTextByType = (type) => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 layer or artboard.")
        return
    }

    let copyData = readDatafromConfig()
    if (!copyData) return

    let updateCounter = 0

    const updateCopyBasedOnDirection = (item, index, direction, itemType) => {
        let copyKey
        let JSONValue = undefined
        let storedKey = Settings.layerSettingForKey(item, prefernceKey.KEY)
        let copyItem = itemType == layerType.TEXT ? item : item.overrides[index]
        let lineHeight =
            itemType == layerType.TEXT
                ? item.style.lineHeight == null
                    ? item.style.getDefaultLineHeight()
                    : item.style.lineHeight
                : copyItem.affectedLayer.style.lineHeight
        let onDisplayValue = itemType == layerType.TEXT ? item.text : copyItem.value
        if (!storedKey) storedKey = {}

        switch (onDisplayValue[0]) {
            case "@":
                copyKey = onDisplayValue.slice(1)
                storedKey[index] = copyKey
                Settings.setLayerSettingForKey(item, prefernceKey.KEY, storedKey)
                break
            case "-":
                if (onDisplayValue[1] == "@") {
                    onDisplayValue = onDisplayValue.slice(2)
                    copyKey = undefined
                    storedKey[index] = copyKey
                    Settings.setLayerSettingForKey(item, prefernceKey.KEY, storedKey)
                } else copyKey = storedKey[index]
                break
            default:
                copyKey = storedKey[index]
        }

        if (copyKey) {
            if (copyKey.indexOf("|") !== -1) {
                const fullValue = resolveValue(copyKey.substr(0, copyKey.indexOf("|")), copyData)
                const option = copyKey
                    .substr(copyKey.indexOf("|") + 1)
                    .replace("…", "...")
                    .replace("⋯", "...")
                // const isTruncatedByLine = option.indexOf("l") !== -1
                let charCount = fullValue.length
                switch (option.indexOf("...")) {
                    case -1:
                        charCount = parseInt(option)
                        JSONValue = fullValue.substr(0, charCount)
                        break
                    case 0:
                        charCount = parseInt(option.substr(3))
                        JSONValue =
                            fullValue.length > charCount
                                ? fullValue.substr(0, Math.round(charCount / 2)) +
                                "..." +
                                fullValue.substr(-Math.round(charCount / 2))
                                : fullValue
                        break
                    default:
                        charCount = parseInt(option.substr(0, option.indexOf("...")))
                        JSONValue = fullValue.length > charCount ? fullValue.substr(0, charCount) + "..." : fullValue
                }
            } else JSONValue = resolveValue(copyKey, copyData)
        }

        const syncCopyFromJSON = () => {
            if (JSONValue && JSONValue != onDisplayValue) {
                updateCounter++
                updateText(copyItem, JSONValue)
            } else updateText(copyItem, onDisplayValue)
        }

        const syncCopyToJSON = () => {
            if (JSONValue != onDisplayValue) {
                updateCounter++
                if (!copyKey) {
                    copyKey = camelize(item.name)
                    if (itemType == layerType.SYMBOLINSTANCE) {
                        copyKey = `${copyKey}.${getFullName(item, copyItem)}`
                    }
                    copyKey = copyKey[0] != "@" ? copyKey : copyKey.slice(1)
                    copyKey = resolveValue(copyKey, copyData) ? `${copyKey}-id:${copyItem.id}` : copyKey
                    storedKey[index] = copyKey
                    Settings.setLayerSettingForKey(item, prefernceKey.KEY, storedKey)
                }
                setValue(copyKey, copyData, onDisplayValue)
            }
        }

        switch (type) {
            case updateType.KEY:
                updateText(copyItem, copyKey ? "@" + copyKey : onDisplayValue)
                break
            case updateType.FROM_JSON:
                syncCopyFromJSON()
                break
            case updateType.TO_JSON:
                syncCopyToJSON()
                break
            case updateType.MIXED:
                if (direction == updateDirection.FROM_JSON) syncCopyFromJSON()
                else syncCopyToJSON()
                break
        }
    }

    const updateChildrenLayers = (layer) => {
        if (layer.layers == undefined) {
            let directions = Settings.layerSettingForKey(layer, prefernceKey.UPDATE_DIRECTION)
            if (!directions) directions = []
            switch (layer.type) {
                case layerType.TEXT:
                    let direction = directions[0] ? directions[0] : updateDirection.FROM_JSON
                    updateCopyBasedOnDirection(layer, 0, direction, layerType.TEXT)
                    break
                case layerType.SYMBOLINSTANCE:
                    layer.overrides.forEach((override, index) => {
                        if (override.property == "stringValue" && override.editable) {
                            let direction = directions[index] ? directions[index] : updateDirection.FROM_JSON
                            updateCopyBasedOnDirection(layer, index, direction, layerType.SYMBOLINSTANCE)
                        }
                    })
                    if (type != updateType.KEY) {
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

    switch (type) {
        case updateType.KEY:
            sketch.UI.message("📍 Reset without auto-resizing")
            break
        case updateType.FROM_JSON:
            sketch.UI.message(`🙌 ${updateCounter} text(s) updated`)
            break
        case updateType.TO_JSON:
            fs.writeFileSync(Settings.documentSettingForKey(doc, prefernceKey.KEY), JSON.stringify(copyData))
            sketch.UI.message(
                `🙌 ${updateCounter} text(s) exported. Please review other text(s) linked with the same key(s)`
            )
            checkUpdate(updateCounter)
            break
        case updateType.MIXED:
            fs.writeFileSync(Settings.documentSettingForKey(doc, prefernceKey.KEY), JSON.stringify(copyData))
            sketch.UI.message(
                `🙌 ${updateCounter} text(s) synced. Please review other text(s) linked with the same key(s)`
            )
            checkUpdate(updateCounter)
            break
    }

    if (Settings.settingForKey(prefernceKey.HAS_DOCUMENTATION) && type != updateType.KEY) syncCopyDoc(copyData)
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
    copy.setBezeled(false)
    copy.setEditable(false)
    copy.setSelectable(false)
    copy.setLineBreakMode(lineBreakMode)

    return copy
}

const createArrowBTN = (layer, index, frame) => {
    const icon = NSButton.alloc().initWithFrame(frame)
    let direction = Settings.layerSettingForKey(layer, prefernceKey.UPDATE_DIRECTION)
    if (!direction) direction = []
    direction[index] = updateDirection.FROM_JSON
    Settings.setLayerSettingForKey(layer, prefernceKey.UPDATE_DIRECTION, direction)

    icon.addCursorRect_cursor(icon.frame(), NSCursor.pointingHandCursor())
    icon.setTitle("←")
    icon.setFont(NSFont.systemFontOfSize(16))
    icon.setBezelStyle(NSRegularSquareBezelStyle)
    icon.setAction("callAction:")
    icon.setCOSJSTargetFunction((sender) => {
        sender.setWantsLayer(true)
        direction = Settings.layerSettingForKey(layer, prefernceKey.UPDATE_DIRECTION)
        if (icon.state()) {
            direction[index] = updateDirection.TO_JSON
            Settings.setDocumentSettingForKey(doc, prefernceKey.UPDATE_DIRECTION, updateType.MIXED)
            icon.setTitle("→")
        } else {
            direction[index] = updateDirection.FROM_JSON
            icon.setTitle("←")
        }
        Settings.setLayerSettingForKey(layer, prefernceKey.UPDATE_DIRECTION, direction)
    })

    return icon
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
    const hotspot = NSButton.alloc().initWithFrame(frame)

    hotspot.addCursorRect_cursor(hotspot.frame(), NSCursor.pointingHandCursor())
    hotspot.setTransparent(true)
    hotspot.setAction("callAction:")
    hotspot.setCOSJSTargetFunction((sender) => {
        sender.setWantsLayer(true)
        if (override) {
            selectOneLayer(override)
        } else selectOneLayer(layer)
        layer.getParentPage().selected = true
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
    const syncDirectionIcon = createArrowBTN(
        item.layer,
        copy.index,
        NSMakeRect(itemWidth * 2 + panelMargin * 0.5, panelMargin * 0.5, panelMargin * 2, panelMargin * 2)
    )

    contentList = [copySetConetent, clickableArea, syncDirectionIcon]
    contentList.forEach((item) => copySetFrame.addSubview(item))

    const copyLayerName = createCopyContent(
        item.name,
        NSMakeRect(panelMargin, 0, itemWidth - panelMargin * 2, itemHeight),
        NSLineBreakByTruncatingTail,
        NSColor.colorWithCalibratedRed_green_blue_alpha(0, 0, 0, 0.7),
        0.1
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
        NSMakeRect(itemWidth * 2 + panelMargin * 3, 0, itemWidth, itemHeight),
        NSLineBreakByWordWrapping
    )

    contentList = [copyLayerName, copyLabel, sketchCopyContent, dataCopyContent]
    contentList.forEach((item) => copySetConetent.addSubview(item))

    return {
        block: copySetFrame,
        direction: syncDirectionIcon,
    }
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
    Settings.setDocumentSettingForKey(doc, prefernceKey.UPDATE_DIRECTION, updateType.FROM_JSON)

    let dialogContent = createView(NSMakeRect(0, 0, panelWidth + scrollBarWidth, panelHeight))

    const layerLabel = createTextLabel("Unsynced layer", NSMakeRect(panelMargin, panelMargin, itemWidth, panelMargin))
    const sketchCopyLable = createTextLabel(
        "Text in Sketch",
        NSMakeRect(itemWidth + panelMargin * 2, panelMargin, itemWidth, panelMargin)
    )
    const dataCopyLabel = createTextLabel(
        "Text in JSON",
        NSMakeRect(itemWidth * 2 + panelMargin * 5, panelMargin, itemWidth, panelMargin)
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
        let unSyncedCopySets = [topDivider, syncToggle]
        let syncDirectionSets = []
        item.list.forEach((copy, j) => {
            const copySet = displayUnsyncedCopy(i, j, unsyncedLayers)
            unSyncedCopySets.push(copySet.block)
            syncDirectionSets.push(copySet.direction)
        })

        syncToggle.setCOSJSTargetFunction((sender) => {
            item.selected = sender.state()
            syncDirectionSets.forEach((direction) => direction.setEnabled(sender.state()))
        })
        unSyncedCopySets.forEach((copySet) => layerFrame.addSubview(copySet))
        resultListScrollContent.addSubview(layerFrame)
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
        updateTextByType(Settings.documentSettingForKey(doc, prefernceKey.UPDATE_DIRECTION))
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

export const checkUpdate = (updateCounter) => {
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
                                {
                                    label: copyKey,
                                    sketchCopy: layer.text,
                                    dataCopy: JSONValue,
                                    index: 0,
                                },
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
                                    index: index,
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
                if (page.selected && page != Settings.documentSettingForKey(doc, prefernceKey.COPY_PAGE_ID))
                    checkChildrenLayers(page)
            })
            break
        case 1: // Pages starting with "@"
            doc.pages.forEach((page) => {
                if (page.name[0] == "@" && page != Settings.documentSettingForKey(doc, prefernceKey.COPY_PAGE_ID))
                    checkChildrenLayers(page)
            })
            break
        case 2: // Entire document
            doc.pages.forEach((page) => {
                if (page.id != Settings.documentSettingForKey(doc, prefernceKey.COPY_PAGE_ID)) checkChildrenLayers(page)
            })
            break
        default:
    }

    if (unsyncedLayers.length !== 0) {
        displayResult(unsyncedLayers, unsyncedCopyAmount)
    } else {
        if (typeof updateCounter == "number") {
            sketch.UI.message(`🙌 ${updateCounter} text(s) exported and no unsynced texts found `)
        } else sketch.UI.message("🙌 No unsynced texts found")
    }
}

export const resetCopy = () => {
    updateTextByType(updateType.KEY)
}

export const pullCopy = () => {
    updateTextByType(updateType.FROM_JSON)
}

export const pushCopy = () => {
    let isPushingFromCopyIndex = false
    selectedLayers.layers.forEach((layer) => {
        isPushingFromCopyIndex =
            layer.getParentPage().id == Settings.documentSettingForKey(doc, prefernceKey.COPY_PAGE_ID)
    })
    if (!isPushingFromCopyIndex) {
        updateTextByType(updateType.TO_JSON)
    } else
        sketch.UI.message(
            "This is a reference page. Please modify the JSON file or the text in your design and push to JSON."
        )
}

export const generateJSON = () => {
    const sourceFilePath = dialog.showSaveDialogSync(doc, {})
    if (sourceFilePath) {
        Settings.setDocumentSettingForKey(doc, prefernceKey.KEY, sourceFilePath)
        const initData = {}
        initData[sourceFilePath] = copyBlockSpec.copyPageName + ": " + getFileName(sourceFilePath)
        fs.writeFileSync(sourceFilePath, JSON.stringify(initData))
        updateTextByType(updateType.TO_JSON)
    }
}

export const setupJSON = () => {
    const selectedFile = dialog.showOpenDialogSync(doc, {
        properties: ["openFile"],
        filters: [{ extensions: ["json"] }],
    })
    const sourceFilePath = selectedFile[0]
    if (sourceFilePath) Settings.setDocumentSettingForKey(doc, prefernceKey.KEY, sourceFilePath)
    if (!selectedLayers.isEmpty) pullCopy()
}
