import dialog from "@skpm/dialog"
const fs = require("@skpm/fs")
const UI = require("sketch/ui")
const sketch = require("sketch")
const ExcelJS = require("exceljs")
const Settings = sketch.Settings
const doc = sketch.getSelectedDocument()
const creator = "Sketch Plugin: Copy Updater - " + doc.id
const selectedLayers = doc.selectedLayers
const indexMarkerName = "@indexMarker"

let base64ImgList = []
let copyList = []
let scale = 1

const layerType = {
    PAGE: "Page",
    ARTBOARD: "Artboard",
    SHAPEPATH: "ShapePath",
    SHAPE: "Shape",
    TEXT: "Text",
    SYMBOLINSTANCE: "SymbolInstance",
    SYMBOLMASTER: "SymbolMaster",
    SLICE: "Slice",
    HOTSPOT: "HotSpot",
    GROUP: "Group",
}

const prefernceKey = {
    KEY: "lzhengCopyUpdaterKey",
    JSON_PATH: "lzhengCopyUPdaterJSONPath",
    EXPORT_ORIENTATION: "exportOrientation",
    EXPORT_SLICE_ONLY: "exportSliceOnly",
    EXPORT_AT_COPY_COPY: "exportAtCopyOnly",
    HAS_COPY_REVISION: "hasCopyRevision",
    HAS_COPY_INDEX: "hasCopyIndex",
    HAS_COPY_KEY: "hasCopyKey",
    HAS_JSON_KEY: "hasJSONKey",
    EXPORT_INVIEW_ONLY: "exportInViewOnly",
}

const prefix = {
    COPY: "copy",
    SYMBOL: "@@symbol",
}

const charNewLine = String.fromCharCode(10)
const exportSliceOnly = Settings.settingForKey(prefernceKey.EXPORT_SLICE_ONLY)
const exportAtCopyOnly = Settings.settingForKey(prefernceKey.EXPORT_AT_COPY_COPY)
const isHorizontal = Settings.settingForKey(prefernceKey.EXPORT_ORIENTATION) === 0
const hasCopyRevision = Settings.settingForKey(prefernceKey.HAS_COPY_REVISION)
const hasCopyIndex = Settings.settingForKey(prefernceKey.HAS_COPY_INDEX)
const hasCopyKey = Settings.settingForKey(prefernceKey.HAS_COPY_KEY)
const hasJSONKey = Settings.settingForKey(prefernceKey.HAS_JSON_KEY)
const exportInViewOnly = Settings.settingForKey(prefernceKey.EXPORT_INVIEW_ONLY)
const columnCount = 2 + (hasCopyIndex ? 1 : 0) + (hasJSONKey ? 1 : 0) + (hasCopyKey ? 1 : 0) + (hasCopyRevision ? 1 : 0)

const imgBolder = {
    bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    left: { style: "thin", color: { argb: "FFFFFFFF" } },
    right: { style: "think", color: { argb: "FFFFFFFF" } },
}

const copyAlignmentCenter = { horizontal: "center", vertical: "middle", indent: 0, shrinkToFit: true }
const copyAlignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 2 }
const fontStyle = { size: 14 }

const sameTextKeyLocation = {}
const sameJSONkeyLocation = {}
const sameJSONCopyLocation = {}
const sameJSONRevisionLocation = {}

const addFormattingForCopyRevision = (worksheet, ref, formulae) => {
    if (hasCopyRevision) {
        worksheet.addConditionalFormatting({
            ref: ref,
            rules: [
                {
                    type: "expression",
                    formulae: [formulae],
                    style: { font: { color: { argb: "FFFF3333" }, bold: true } },
                },
                {
                    type: "expression",
                    formulae: [formulae],
                    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFCCCC" } } },
                },
            ],
        })
    }
}

const getColLetterByNumber = (int) => {
    let col = ""
    for (let a = 1, b = 26; (int -= a) >= 0; a = b, b *= 26) {
        col = String.fromCharCode(parseInt((int % b) / a) + 65) + col
    }
    return col
}

const getCopyContent = (
    copyItem,
    index,
    keyColLetter,
    jsonColLetter,
    copyColLetter,
    revisionColLetter,
    rowIndex,
    sheetName
) => {
    const copyContent = [null]
    const trimmedText = copyItem.text.replace(/[^\w\s]/gi, "")

    if (hasCopyIndex) copyContent.push(index + 1)
    if (hasCopyKey) {
        if (sameTextKeyLocation[copyItem.id || trimmedText]) {
            copyContent.push(sameTextKeyLocation[copyItem.id || trimmedText])
        } else {
            sameTextKeyLocation[copyItem.id || trimmedText] = {
                text: copyItem.key,
                hyperlink: `#\'${sheetName}\'!${keyColLetter}${rowIndex}`,
                tooltip: "Navigate to the key reference cell",
            }
            copyContent.push(copyItem.key)
        }
    }
    if (hasJSONKey) {
        if (copyItem.id) {
            if (sameJSONkeyLocation[copyItem.id]) {
                copyContent.push(sameJSONkeyLocation[copyItem.id])
            } else {
                sameJSONkeyLocation[copyItem.id] = {
                    text: copyItem.id,
                    hyperlink: `#\'${sheetName}\'!${jsonColLetter}${rowIndex}`,
                    tooltip: "Navigate to the content reference cell",
                }
                copyContent.push(copyItem.id)
            }
        } else copyContent.push(null)
    }

    if (copyItem.id) {
        if (sameJSONCopyLocation[copyItem.id]) {
            copyContent.push(sameJSONCopyLocation[copyItem.id])
            if (hasCopyRevision) copyContent.push(sameJSONRevisionLocation[copyItem.id])
        } else {
            sameJSONCopyLocation[copyItem.id] = {
                formula: `${copyColLetter}${rowIndex}`,
                result: copyItem.text,
            }
            sameJSONRevisionLocation[copyItem.id] = {
                formula: `${revisionColLetter}${rowIndex}`,
                result: copyItem.text,
            }
            copyContent.push(copyItem.text)
            if (hasCopyRevision) copyContent.push(copyItem.text)
        }
    } else {
        if (sameJSONCopyLocation[trimmedText]) {
            copyContent.push(sameJSONCopyLocation[trimmedText])
            if (hasCopyRevision) copyContent.push(sameJSONRevisionLocation[trimmedText])
        } else {
            sameJSONCopyLocation[trimmedText] = {
                formula: `${copyColLetter}${rowIndex}`,
                result: copyItem.text,
            }
            sameJSONRevisionLocation[trimmedText] = {
                formula: `${revisionColLetter}${rowIndex}`,
                result: copyItem.text,
            }
            copyContent.push(copyItem.text)
            if (hasCopyRevision) copyContent.push(copyItem.text)
        }
    }

    return copyContent
}

const getColumns = (i, screenName, currentCopyTitle) => {
    const columns = [{ name: `${i + 1}. ${screenName}` }]
    if (hasCopyIndex) columns.push({ name: "Id" })
    if (hasCopyKey) columns.push({ name: "Name" })
    if (hasJSONKey) columns.push({ name: "JSON" })
    columns.push({ name: currentCopyTitle })
    if (hasCopyRevision) columns.push({ name: "Copy Revision" })
    return columns
}

const generateHorizontalSheet = (workbook, worksheet, currentCopyTitle) => {
    const rowHeight = 40
    const vColumnCount = columnCount + 1 // + divider

    worksheet.properties.defaultRowHeight = rowHeight
    worksheet.views = [{ state: "frozen", ySplit: 1 }]
    worksheet.pageSetup = {
        orientation: hasCopyRevision ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: base64ImgList.length,
        fitToHeight: 1,
    }

    const headerRow = worksheet.getRow(1)
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

    base64ImgList.forEach((imgItem, i) => {
        let copies = []
        const scaledImgWidth = imgItem.width / scale
        const screenName = copyList[i][0].text
        const tableName = ["\\", i + 1, "_", screenName.replace(/[^A-Z0-9]+/gi, "_")].join("")
        let colIndex = 0
        const imgCol = worksheet.getColumn(i * vColumnCount + ++colIndex)
        const indexCol = hasCopyIndex ? worksheet.getColumn(i * vColumnCount + ++colIndex) : null
        const keyColLetter = hasCopyKey ? getColLetterByNumber(i * vColumnCount + ++colIndex) : null
        const keyCol = hasCopyKey ? worksheet.getColumn(keyColLetter) : null
        const jsonColLetter = hasJSONKey ? getColLetterByNumber(i * vColumnCount + ++colIndex) : null
        const jsonCol = hasJSONKey ? worksheet.getColumn(jsonColLetter) : null
        const copyColLetter = getColLetterByNumber(i * vColumnCount + ++colIndex)
        const copyCol = worksheet.getColumn(copyColLetter)
        const revisionColLetter = hasCopyRevision ? getColLetterByNumber(i * vColumnCount + ++colIndex) : null
        const revisionCol = hasCopyRevision ? worksheet.getColumn(revisionColLetter) : null
        const dividerCol = worksheet.getColumn(i * vColumnCount + ++colIndex)

        copyList[i].slice(1).forEach((copyItem, index) => {
            copies.push(
                getCopyContent(
                    copyItem,
                    index,
                    keyColLetter,
                    jsonColLetter,
                    copyColLetter,
                    revisionColLetter,
                    index + 2,
                    currentCopyTitle
                )
            )
        })

        const columns = getColumns(i, screenName, currentCopyTitle)

        worksheet.addTable({
            name: tableName,
            ref: getColLetterByNumber(i * vColumnCount + 1) + 1,
            headerRow: true,
            columns: [...columns],
            rows: [...copies],
        })

        imgCol.width = scaledImgWidth / 8
        imgCol.border = imgBolder
        if (hasCopyIndex) {
            indexCol.width = 10
            indexCol.font = fontStyle
            indexCol.alignment = copyAlignmentCenter
        }

        if (hasCopyKey) {
            keyCol.width = 30
            keyCol.font = fontStyle
            keyCol.alignment = copyAlignment
        }

        if (hasJSONKey) {
            jsonCol.width = 30
            jsonCol.font = fontStyle
            jsonCol.alignment = copyAlignment
        }

        copyCol.width = 60
        copyCol.font = fontStyle
        copyCol.alignment = copyAlignment
        copyCol.border = {
            right: { style: "think", color: { argb: "FFFFFFFF" } },
        }

        if (hasCopyRevision) {
            revisionCol.width = 60
            revisionCol.font = { size: 14, color: { argb: "FFBBBBBB" } }
            revisionCol.alignment = copyAlignment
            revisionCol.border = {
                right: { style: "think", color: { argb: "FFFFFFFF" } },
            }
            addFormattingForCopyRevision(
                worksheet,
                "$" + revisionColLetter + ":$" + revisionColLetter,
                "$" + revisionColLetter + "1<>$" + copyColLetter + "1"
            )
        }
        dividerCol.width = 4
        dividerCol.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF999999" } }

        const scaledImgHeight = scaledImgWidth * imgItem.ratio

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: i * vColumnCount, row: 1 },
            br: { col: i * vColumnCount + 1, row: scaledImgHeight / rowHeight / 1.2 },
        })
    })

    headerRow.font = { bold: true, size: 20 }
    headerRow.alignment = copyAlignment
}

const getRowCount = (text, colWidth) => {
    const paragraphList = text.split(charNewLine)
    let count = 0
    paragraphList.forEach((paragraph) => {
        if (paragraph.length === 0) {
            count++
        } else count += Math.ceil(paragraph.length / colWidth)
    })
    return count
}

const generateVerticalSheet = (workbook, worksheet, currentCopyTitle) => {
    const scaledImgWidth = base64ImgList[0].width / scale
    const columnWidth = 80
    const heightUnit = 20
    let colIndex = 0
    const imgCol = worksheet.getColumn(++colIndex)
    const indexCol = hasCopyIndex ? worksheet.getColumn(++colIndex) : null
    const keyCol = hasCopyKey ? worksheet.getColumn(++colIndex) : null
    const jsonCol = hasJSONKey ? worksheet.getColumn(++colIndex) : null
    const copyCol = worksheet.getColumn(++colIndex)
    const revisionCol = hasCopyRevision ? worksheet.getColumn(++colIndex) : null
    let currentRow = 1

    worksheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: base64ImgList.length,
        printArea: "",
        cellComments: "asDisplayed",
    }

    worksheet.views = [{ state: "frozen", xSplit: hasCopyIndex ? 2 : 1 }]

    imgCol.width = scaledImgWidth / 8
    imgCol.border = imgBolder

    if (hasCopyIndex) {
        indexCol.width = columnWidth / 12
        indexCol.font = fontStyle
        indexCol.alignment = copyAlignmentCenter
    }

    if (hasCopyKey) {
        keyCol.width = (columnWidth / 8) * 3
        keyCol.font = fontStyle
        keyCol.alignment = copyAlignment
    }

    if (hasJSONKey) {
        jsonCol.width = (columnWidth / 8) * 3
        jsonCol.font = fontStyle
        jsonCol.alignment = copyAlignment
    }

    copyCol.width = (columnWidth / 8) * 6
    copyCol.font = fontStyle
    copyCol.alignment = copyAlignment

    const keyColLetter = hasCopyIndex ? getColLetterByNumber(3) : getColLetterByNumber(2)
    const jsonColLetter = hasCopyRevision
        ? getColLetterByNumber(columnCount - 2)
        : getColLetterByNumber(columnCount - 1)
    const copyColLetter = hasCopyRevision ? getColLetterByNumber(columnCount - 1) : getColLetterByNumber(columnCount)
    const copyRevisionColLetter = getColLetterByNumber(columnCount)

    if (hasCopyRevision) {
        revisionCol.width = (columnWidth / 8) * 6
        revisionCol.font = { size: 14, color: { argb: "FFBBBBBB" } }
        revisionCol.alignment = copyAlignment
        addFormattingForCopyRevision(
            worksheet,
            `$${copyRevisionColLetter}:$${copyRevisionColLetter}`,
            `$${copyRevisionColLetter}1<>$${copyColLetter}1`
        )
    }

    base64ImgList.forEach((imgItem, i) => {
        const screenName = copyList[i][0].text
        const tableName = ["\\", i + 1, "_", screenName.replace(/[^A-Z0-9]+/gi, "_")].join("")
        let copies = []
        const scaledImgHeight = scaledImgWidth * imgItem.ratio
        const headerRow = worksheet.getRow(currentRow)
        headerRow.font = { bold: true, size: 20 }
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } }

        let minimumRow = currentRow + Math.ceil(scaledImgHeight / heightUnit / 1.25)

        copyList[i].slice(1).forEach((copyItem, index) => {
            const currentCopyRowIndex = currentRow + index + 1
            copies.push(
                getCopyContent(
                    copyItem,
                    index,
                    keyColLetter,
                    jsonColLetter,
                    copyColLetter,
                    copyRevisionColLetter,
                    currentCopyRowIndex,
                    currentCopyTitle
                )
            )
            minimumRow -= getRowCount(copyItem.text, columnWidth) - 1
        })

        let targetRow = minimumRow > currentRow + copies.length ? minimumRow : currentRow + copies.length
        const additonalRows =
            targetRow - currentRow - copies.length - 2 > 0 ? targetRow - currentRow - copies.length - 2 : 0
        targetRow = additonalRows === 0 ? targetRow + 1 : targetRow

        copies = copies.concat(new Array(additonalRows).fill(new Array(columnCount).fill("")))
        const columns = getColumns(i, screenName, currentCopyTitle)

        worksheet.addTable({
            name: tableName,
            ref: "A" + currentRow,
            headerRow: true,
            columns: [...columns],
            rows: [...copies],
        })

        const image = workbook.addImage({
            base64: imgItem.img,
            extension: "jpeg",
        })
        worksheet.addImage(image, {
            tl: { col: 0, row: currentRow },
            ext: { width: scaledImgWidth, height: scaledImgHeight },
        })

        imgCol.eachCell((cell) => (cell.name = "Print_Area"))
        if (hasCopyIndex) indexCol.eachCell((cell) => (cell.name = "Print_Area"))
        if (hasCopyKey) keyCol.eachCell((cell) => (cell.name = "Print_Area"))
        if (hasJSONKey) jsonCol.eachCell((cell) => (cell.name = "Print_Area"))
        copyCol.eachCell((cell) => (cell.name = "Print_Area"))
        if (hasCopyRevision) revisionCol.eachCell((cell) => (cell.name = "Print_Area"))

        currentRow = targetRow + 1
    })
}

const readExcel = (path) => {
    try {
        const data = fs.readFileSync(path)
        return data
    } catch (error) {
        return undefined
    }
}

const saveAsExcel = async (ExcelFilePath) => {
    const date = new Date()
    const sheetName = `${date.getFullYear()}-${
        date.getMonth() + 1
    }-${date.getDate()} (${date.getHours()}.${date.getMinutes()}.${date.getSeconds()})`
    let workbook = new ExcelJS.Workbook()
    let isNew = true

    const data = readExcel(ExcelFilePath)
    if (data) {
        UI.message("Reading existing file...")
        await workbook.xlsx.load(data)
    }
    if (workbook.creator === creator) {
        isNew = false
    } else workbook = new ExcelJS.Workbook()

    workbook.modified = date
    workbook.creator = creator

    const worksheet = workbook.addWorksheet(sheetName)

    if (!isNew) {
        workbook.worksheets[0].tables = {}
        workbook.definedNames.getMatrix("Print_Area").sheets = {}
        workbook.eachSheet((sheet) => (sheet.orderNo = sheet === worksheet ? 0 : sheet.orderNo + 1))
    }
    if (isHorizontal) {
        generateHorizontalSheet(workbook, worksheet, sheetName)
    } else generateVerticalSheet(workbook, worksheet, sheetName)

    UI.message("Saving (Large file with multiple sheets takes longer time)...")

    const buf = await workbook.xlsx.writeBuffer()
    fs.writeFileSync(ExcelFilePath, buf)
    UI.message("🚀 Successfully Exported")
}

const getImgFromLayer = (layer) => {
    const imgBuffer = sketch.export(layer, { formats: "jpg", output: false })
    const base64Img = "data:image/jpeg;base64," + imgBuffer.toString("base64")
    return base64Img
}

const isNamePrefixIncludeAt = (layer) => {
    return layer.name.indexOf("@@") === 0
}

const isSlicePrefixInclude = (layer, text) => {
    if (layer.exportFormats.length > 0) {
        let exportable = false
        layer.exportFormats.forEach((slice) => {
            if (slice.prefix === text || slice.suffix === text) exportable = true
        })
        return exportable
    } else return false
}

const setSlicePrefix = (layer, prefix) => {
    layer.exportFormats.push({
        prefix: prefix,
    })
}

const getTransformedText = (rule, text) => {
    switch (rule) {
        case "uppercase":
            return text.toUpperCase()
        case "lowercase":
            return text.toLowerCases()
        default:
            return text
    }
}

const swapContentInArray = (array, id1, id2) => {
    let tempItem = array[id1]
    array[id1] = array[id2]
    array[id2] = tempItem
}

const sortArtboardTBLR = (artboards) => {
    let sortedArtboards = [...artboards]
    for (let i = 0; i < sortedArtboards.length - 1; i++) {
        for (let j = 0; j < sortedArtboards.length - i - 1; j++) {
            if (sortedArtboards[j].frame.y > sortedArtboards[j + 1].frame.y)
                swapContentInArray(sortedArtboards, j, j + 1)
            else if (
                sortedArtboards[j].frame.y === sortedArtboards[j + 1].frame.y &&
                sortedArtboards[j].frame.x > sortedArtboards[j + 1].frame.x
            )
                swapContentInArray(sortedArtboards, j, j + 1)
        }
    }
    return sortedArtboards
}

const sortCopyTBLR = (copys) => {
    let sortedCopys = [...copys]
    for (let i = 1; i < sortedCopys.length - 1; i++) {
        for (let j = 1; j < sortedCopys.length - i; j++) {
            if (sortedCopys[j].y > sortedCopys[j + 1].y) {
                swapContentInArray(sortedCopys, j, j + 1)
            } else if (sortedCopys[j].y === sortedCopys[j + 1].y && sortedCopys[j].x > sortedCopys[j + 1].x) {
                swapContentInArray(sortedCopys, j, j + 1)
            }
        }
    }
    return sortedCopys
}

const extractCopy = (artboard, i, width, height) => {
    artboard.layers.forEach((layer) => {
        if (
            layer.type !== layerType.TEXT ||
            (exportInViewOnly &&
                (layer.frame.x > width ||
                    layer.frame.y > height ||
                    layer.frame.x + layer.frame.width < 0 ||
                    layer.frame.y + layer.frame.height < 0)) ||
            (exportSliceOnly && !isSlicePrefixInclude(layer, prefix.COPY)) ||
            (exportAtCopyOnly && !isNamePrefixIncludeAt(layer))
        )
            return

        copyList[i].push({
            key: layer.name.replace("@@", "").split("@@").reverse().join("/"),
            x: layer.frame.x,
            y: layer.frame.y,
            text: getTransformedText(layer.style.textTransform, layer.text),
        })
    })
}

const flattenGroup = (group) => {
    let isFlat = true
    do {
        isFlat = true
        group.layers.forEach((layer) => {
            if (layer.hidden) {
                layer.remove()
                return
            }
            switch (layer.type) {
                case layerType.SYMBOLINSTANCE:
                    layer.overrides.forEach((override, index) => {
                        // const key = Settings.layerSettingForKey(layer, prefernceKey.KEY)
                        if (override.property === "stringValue") {
                            // console.log(index, override.affectedLayer.name, key[index])
                        }
                    })
                    const symbolGroup = layer.detach({ recursively: false })
                    if (symbolGroup === null) {
                        layer.remove()
                    } else {
                        if (exportSliceOnly && isSlicePrefixInclude(layer, prefix.COPY))
                            symbolGroup.layers.forEach((sublayer) => setSlicePrefix(sublayer, prefix.COPY))
                        if (exportAtCopyOnly && !isNamePrefixIncludeAt(layer)) symbolGroup.remove()
                        symbolGroup.layers.forEach((sublayer, index) => {
                            sublayer.name += symbolGroup.name
                        })
                        symbolGroup.sketchObject.ungroup()
                        isFlat = false
                    }
                    break
                case layerType.GROUP:
                    if (exportSliceOnly && isSlicePrefixInclude(layer, prefix.COPY))
                        layer.layers.forEach((sublayer) => setSlicePrefix(sublayer, prefix.COPY))
                    layer.sketchObject.ungroup()
                    isFlat = false
                    break
                case layerType.TEXT:
                    if (exportAtCopyOnly && !isNamePrefixIncludeAt(layer)) layer.remove()
                    break
                default:
                    layer.remove()
            }
        })
    } while (!isFlat)
}

const createIndexMarker = (page) => {
    const artboard = new sketch.Artboard({ name: indexMarkerName })
    const size = 24
    artboard.parent = page
    artboard.frame.width = size
    artboard.frame.height = size

    const circle = sketch.ShapePath.fromSVGPath(
        "M12,24 C18.627417,24 24,18.627417 24,12 C24,5.372583 18.627417,0 12,0 C5.372583,0 0,5.372583 0,12 C0,18.627417 5.372583,24 12,24 Z"
    )
    circle.parent = artboard
    circle.style.fills = [
        {
            color: "#ff0000",
            fillType: sketch.Style.FillType.Color,
        },
    ]

    const index = new sketch.Text({
        text: "0",
        style: {
            alignment: sketch.Text.Alignment.center,
            verticalAlignment: sketch.Text.VerticalAlignment.center,
            fontSize: 16,
            lineHeight: size,
            textColor: "#ffffff",
            borders: [],
            fontWeight: 12,
        },
        parent: artboard,
    })
    index.frame.x = 0
    index.frame.y = 0
    index.frame.width = size
    index.frame.height = size

    return sketch.SymbolMaster.fromArtboard(artboard)
}

const getClonedArtboard = (page, sourceArtboard, marker) => {
    const tempArtboard = new sketch.Artboard()
    const widthOffset = marker ? marker.frame.width : 0
    const heightOffset = marker ? marker.frame.height : 0
    tempArtboard.frame.width = sourceArtboard.frame.width + widthOffset * 2
    tempArtboard.frame.height = sourceArtboard.frame.height + heightOffset * 2
    tempArtboard.parent = page

    const buffer = sketch.export(sourceArtboard, { scales: 3, formats: "png", output: false })
    const img = sketch.createLayerFromData(buffer, "bitmap")
    img.frame.x = widthOffset
    img.frame.y = heightOffset
    img.frame.width = sourceArtboard.frame.width
    img.frame.height = sourceArtboard.frame.height
    img.parent = tempArtboard

    return tempArtboard
}

const exportContent = (layer, i, x, y, width, height) => {
    if (layer.layers === undefined) {
        if (
            (exportSliceOnly && !isSlicePrefixInclude(layer, prefix.COPY)) ||
            (exportAtCopyOnly && !isNamePrefixIncludeAt(layer)) ||
            layer.hidden
        ) {
            layer.remove()
            return
        } else {
            const storedKey = Settings.layerSettingForKey(layer, prefernceKey.KEY)
            const JSONPath = Settings.layerSettingForKey(layer, prefernceKey.JSON_PATH)

            switch (layer.type) {
                case layerType.TEXT:
                    if (
                        exportInViewOnly &&
                        (x > width || y > height || x + layer.frame.width < 0 || y + layer.frame.height < 0)
                    ) {
                        layer.remove()
                        return
                    } else {
                        copyList[i].push({
                            path: JSONPath ? JSONPath : undefined,
                            key: layer.name.replace("@@", ""),
                            id: storedKey ? storedKey[0] : undefined,
                            x: x,
                            y: y,
                            text: getTransformedText(layer.style.textTransform, layer.text),
                        })
                    }
                    break
                case layerType.SYMBOLINSTANCE:
                    let copies = []
                    let hiddenInfo = {}

                    const isParrentHidden = (path) => {
                        if (!path || path === "") {
                            return false
                        } else if (hiddenInfo[path]) {
                            return true
                        } else return isParrentHidden(path.substring(0, path.lastIndexOf("/")))
                    }

                    layer.overrides.forEach((override, j) => {
                        hiddenInfo[override.path] = override.affectedLayer.hidden
                        if (!override.affectedLayer.hidden && override.property === "stringValue") {
                            const isParentHidden = isParrentHidden(override.path)
                            if (!isParentHidden)
                                copies.push({
                                    path: JSONPath ? JSONPath : undefined,
                                    id: storedKey ? storedKey[j] : undefined,
                                    text: override.value,
                                })
                        }
                    })

                    let index = copies.length
                    const reviewOverride = (override, copyPrefix, x, y, isAtCopy, isCopySlice, isHidden) => {
                        // console.log(override.name, y)
                        // if (isHidden) {
                        //     override.remove()
                        //     return
                        // }
                        const detachedGroup =
                            override.type === layerType.SYMBOLINSTANCE
                                ? override.detach({ recursively: false })
                                : override

                        if (detachedGroup.layers === undefined) {
                            if (detachedGroup.type === layerType.TEXT) {
                                index--
                                copies[index] = {
                                    ...copies[index],
                                    key: copyPrefix,
                                    x: x,
                                    y: y,
                                    isIncluded: exportAtCopyOnly
                                        ? isAtCopy && isNamePrefixIncludeAt(detachedGroup)
                                        : exportSliceOnly
                                        ? isCopySlice && isSlicePrefixInclude(detachedGroup, prefix.COPY)
                                        : false,
                                    hidden: isHidden,
                                }
                            } else detachedGroup.remove()
                        } else {
                            detachedGroup.layers.forEach((sublayer) => {
                                if (sublayer.hidden) sublayer.remove()
                            })
                            detachedGroup.adjustToFit()
                            detachedGroup.layers.forEach((sublayer) => {
                                reviewOverride(
                                    sublayer,
                                    copyPrefix + " / " + sublayer.name.replace("@@", "").trim(),
                                    x + sublayer.frame.x,
                                    y + sublayer.frame.y,
                                    isAtCopy && isNamePrefixIncludeAt(detachedGroup),
                                    isCopySlice && isSlicePrefixInclude(detachedGroup, prefix.COPY),
                                    isHidden || sublayer.hidden
                                )
                            })
                        }
                    }
                    reviewOverride(layer, layer.name.replace("@@", "").trim(), x, y, true, true, layer.hidden)

                    if (exportAtCopyOnly || exportSliceOnly) {
                        const copyListWithScope = []
                        copies.forEach((copy) => {
                            if (copy.isIncluded && !copy.hidden) copyListWithScope.push(copy)
                        })
                        copies = [...copyListWithScope]
                    }

                    copyList[i] = [...copyList[i], ...copies]
                    break
                default:
                    layer.remove()
            }
        }
    } else
        layer.layers.forEach((sublayer) => {
            if (sublayer.hidden) {
                sublayer.remove()
            } else exportContent(sublayer, i, x + sublayer.frame.x, y + sublayer.frame.y, width, height)
        })
}

export const generateExcel = async () => {
    if (selectedLayers.isEmpty) {
        sketch.UI.message("❌ Please select at least 1 artboard.")
        return
    }
    const selectedArtboards = sortArtboardTBLR(selectedLayers.layers)

    const ExcelFilePath = dialog.showSaveDialogSync(doc, { filters: [{ extensions: ["xlsx"] }] })

    if (ExcelFilePath) {
        UI.getInputFromUser(
            "What's the image scale do you want to export?",
            {
                initialValue: "1x",
                type: UI.INPUT_TYPE.selection,
                possibleValues: ["0.25x", "0.5x", "0.75x", "1x"],
                description: "Depends on the amount of text, it may take a few seconds...",
            },
            (err, value) => {
                if (err) return

                scale = 1 / parseFloat(value)

                let symbolPage = undefined
                let indexMarkerMaster = undefined
                let selectedPage = doc.selectedPage
                const tempPage = new sketch.Page({ name: "temp" })
                tempPage.parent = doc

                if (hasCopyIndex) {
                    symbolPage = sketch.Page.getSymbolsPage(doc) || sketch.Page.createSymbolsPage()
                    symbolPage.parent = doc
                    const indexMarkerList = sketch.find(
                        `${layerType.SYMBOLMASTER}, [name="${indexMarkerName}"]`,
                        symbolPage
                    )
                    indexMarkerMaster =
                        indexMarkerList.length > 0
                            ? indexMarkerList[0]
                            : createIndexMarker(sketch.Page.getSymbolsPage(doc))
                }

                selectedArtboards.forEach((artboard) => {
                    if (artboard.type === layerType.ARTBOARD) {
                        copyList.push([{ key: "Name", text: artboard.name }])

                        const tempArtboardCopy = artboard.duplicate()
                        tempArtboardCopy.parent = tempPage
                        // flattenGroup(tempArtboardCopy)
                        // extractCopy(tempArtboardCopy, copyList.length - 1, artboard.frame.width, artboard.frame.height)
                        exportContent(
                            tempArtboardCopy,
                            copyList.length - 1,
                            0,
                            0,
                            tempArtboardCopy.frame.width,
                            tempArtboardCopy.frame.height
                        )
                        copyList[copyList.length - 1] = sortCopyTBLR(copyList[copyList.length - 1])
                        tempArtboardCopy.remove()
                        // const tempArtboardImgSource = getClonedArtboard(tempPage, artboard, indexMarkerMaster)
                        const tempArtboardImgSource = artboard.duplicate()
                        tempArtboardImgSource.parent = tempPage
                        new sketch.Group({
                            layers: tempArtboardImgSource.layers,
                            parent: tempArtboardImgSource,
                        })

                        if (hasCopyIndex) {
                            copyList[copyList.length - 1].forEach((copyInfo, index) => {
                                if (index === 0) return
                                const marker = indexMarkerMaster.createNewInstance()
                                marker.parent = tempArtboardImgSource
                                marker.overrides.forEach((override) => {
                                    if (override.property == "stringValue") override.value = index
                                })
                                marker.frame.x = copyInfo.x - (marker.frame.width / 4) * 3
                                marker.frame.y = copyInfo.y - (marker.frame.height / 4) * 3
                            })
                        }

                        base64ImgList.push({
                            img: getImgFromLayer(tempArtboardImgSource),
                            width: tempArtboardImgSource.frame.width,
                            ratio: tempArtboardImgSource.frame.height / tempArtboardImgSource.frame.width,
                        })
                        tempArtboardImgSource.remove()
                    }
                })

                tempPage.remove()
                if (hasCopyIndex) {
                    symbolPage.selected = true
                    doc.centerOnLayer(indexMarkerMaster)
                } else selectedPage.selected = true
                if (base64ImgList.length > 0) saveAsExcel(ExcelFilePath)
            }
        )
    }
}
